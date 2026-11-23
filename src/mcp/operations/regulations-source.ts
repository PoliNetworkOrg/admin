import { createHash } from "node:crypto"

import { HocuspocusProvider, HocuspocusProviderWebsocket, type onMessageParameters } from "@hocuspocus/provider"
import * as Y from "yjs"
import { z } from "zod"

import {
  allowedPath,
  entryFile,
  FILE_NAME,
  inputInsertion,
  inputLinesOf,
} from "@/features/regulations/editor/draft-files"
import { createComment, issueCollabTicket } from "@/features/regulations/regulations-editor.functions"
import { type CollabTicket, draftIdSchema } from "@/features/regulations/regulations.contract"
import { getDraftFiles } from "@/features/regulations/regulations.functions"

import type { Operation } from "../operation"

/**
 * A draft's LaTeX source, read and edited in the collab service (Hocuspocus) the way the editor does: a single-use
 * ticket from `issueCollabTicket` (its middleware and the backend's per-draft role apply), one connection per call,
 * `ydoc.getMap("files")` mapping each path to its `Y.Text`. Writes are Y.js transactions the service acknowledges
 * before the call returns, so they merge with what others type instead of overwriting it.
 */

const TICKET_TIMEOUT_MS = 15_000
const SYNC_TIMEOUT_MS = 15_000
const ACK_TIMEOUT_MS = 15_000
/** Hocuspocus's message type for "your update was applied" (1) or refused (0). */
const SYNC_STATUS_MESSAGE = 8

const pathSchema = z.string().min(1).max(200)
/** SHA-256 of a file's text, as `readSource` returns it. */
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/, "The file's hash from regulations.drafts.readSource.")

export const readSourceInput = z.object({
  draftId: draftIdSchema,
  /** Only these files' text; every file's path and hash come back anyway. */
  paths: z.array(pathSchema).max(100).optional(),
})

const sourceEditSchema = z.object({
  old: z.string().min(1).max(100_000),
  new: z.string().max(100_000),
  /** Replace every occurrence instead of requiring exactly one. */
  replaceAll: z.boolean().default(false),
})

const sourceChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), path: pathSchema, edits: z.array(sourceEditSchema).min(1).max(100) }),
  z.object({ action: z.literal("write"), path: pathSchema, content: z.string().max(1_000_000), baseHash: hashSchema }),
  z.object({
    action: z.literal("create"),
    path: pathSchema,
    content: z.string().max(1_000_000).default(""),
    /** Add its `\input` to the main file, after the last one and in its style, as "Includilo" does. */
    include: z.boolean().default(false),
  }),
  z.object({ action: z.literal("delete"), path: pathSchema, baseHash: hashSchema }),
])

export const editSourceInput = z.object({
  draftId: draftIdSchema,
  changes: z.array(sourceChangeSchema).min(1).max(50),
})

export const commentOnTextInput = z.object({
  draftId: draftIdSchema,
  file: pathSchema,
  /** The exact text to comment on, as it is in the file now. */
  quote: z.string().min(1).max(2000),
  /** Which occurrence (1 = first) when the text occurs more than once. */
  occurrence: z.number().int().min(1).optional(),
  body: z.string().trim().min(1).max(5000),
})

type SourceChange = z.output<typeof sourceChangeSchema>
/** A file as readSource returns it; `text` only for the files asked for. */
type SourceFile = { path: string; hash: string; length: number; text?: string }
type Splice = { path: string; index: number; remove: number; insert: string }
type Step =
  | { kind: "splice"; splice: Splice }
  | { kind: "create"; path: string; text: string }
  | { kind: "delete"; path: string }

type DraftSession = {
  ticket: CollabTicket
  provider: HocuspocusProvider
  files: Y.Map<Y.Text>
  readOnly: boolean
  /** Resolves once the service has applied every local change; rejects when it refuses one or the connection ends. */
  acknowledged: () => Promise<void>
  close: () => void
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex")
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000} s.`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** A Hocuspocus message's type and, for a sync status, whether the update was applied. */
function syncStatusOf({ message }: onMessageParameters) {
  message.readVarString()
  if (message.readVarUint() !== SYNC_STATUS_MESSAGE) return null
  // The status is a lib0 varInt 0 or 1, one byte that reads the same as a varUint.
  return message.readVarUint() === 1
}

/** The service's `{ "type": "state" }` notice: the draft froze or reopened, so this connection's rights changed. */
const stateNoticeSchema = z.object({ type: z.literal("state") })
function isStateChange(payload: string) {
  try {
    return stateNoticeSchema.safeParse(JSON.parse(payload)).success
  } catch (error) {
    console.error(error)
    return false
  }
}

/** Connects to the draft's collab document with a fresh ticket and waits until it has synced. */
async function openDraft(draftId: string): Promise<DraftSession> {
  const ticket = await withTimeout(
    issueCollabTicket({ data: { draftId } }),
    TICKET_TIMEOUT_MS,
    "Asking the backend for a collab ticket"
  )
  const document = new Y.Doc()
  let failure: Error | null = null
  const waiters = new Set<(error: Error | null) => void>()
  const settle = (error: Error | null) => {
    if (error) failure ??= error
    for (const waiter of waiters) waiter(error)
  }
  const socket = new HocuspocusProviderWebsocket({
    url: ticket.url,
    // One attempt: the ticket is single-use, so a reconnection could only be refused.
    maxAttempts: 1,
    onMaxAttemptsFailed: () => settle(new Error("Could not connect to the collab service.")),
    onDisconnect: () => settle(new Error("The collab service closed the connection.")),
  })
  const provider = new HocuspocusProvider({
    websocketProvider: socket,
    name: ticket.documentName,
    document,
    // No presence: this connection lives for one call and shows no cursor to the people editing.
    awareness: null,
    token: ticket.ticket,
    onAuthenticationFailed: ({ reason }) => settle(new Error(`The collab service refused the ticket: ${reason}`)),
    onSynced: ({ state }) => {
      if (state) settle(null)
    },
    onUnsyncedChanges: ({ number }) => {
      if (number === 0) settle(null)
    },
    onMessage: (parameters) => {
      if (syncStatusOf(parameters) === false)
        settle(new Error("The collab service refused the change: the draft is read-only for this account now."))
    },
    onStateless: ({ payload }) => {
      if (isStateChange(payload))
        settle(new Error("The draft changed state during the call (frozen or reopened): read it again."))
    },
  })
  const close = () => {
    provider.destroy()
    socket.destroy()
    document.destroy()
  }
  const until = (done: () => boolean, ms: number, what: string) =>
    withTimeout(
      new Promise<void>((resolve, reject) => {
        const check = () => {
          if (failure) {
            waiters.delete(check)
            reject(failure)
          } else if (done()) {
            waiters.delete(check)
            resolve()
          }
        }
        waiters.add(check)
        check()
      }),
      ms,
      what
    )
  let synced = false
  try {
    provider.attach()
    await until(() => provider.isSynced, SYNC_TIMEOUT_MS, "Loading the draft from the collab service")
    synced = true
  } finally {
    // A failed connection is closed here; a synced one by `withDraft` once the call is done.
    if (!synced) close()
  }
  return {
    ticket,
    provider,
    files: document.getMap<Y.Text>("files"),
    readOnly: ticket.readOnly || provider.authorizedScope === "readonly",
    acknowledged: () =>
      until(() => !provider.hasUnsyncedChanges, ACK_TIMEOUT_MS, "Waiting for the collab service to save the change"),
    close,
  }
}

async function withDraft<T>(draftId: string, use: (session: DraftSession) => Promise<T> | T) {
  const session = await openDraft(draftId)
  try {
    return await use(session)
  } finally {
    session.close()
  }
}

function textsOf(files: Y.Map<Y.Text>) {
  return new Map([...files.entries()].map(([path, text]) => [path, text.toJSON()]))
}

export async function readSource(input: z.output<typeof readSourceInput>) {
  return withDraft(input.draftId, ({ ticket, files, readOnly }) => {
    const texts = textsOf(files)
    const missing = (input.paths ?? []).filter((path) => !texts.has(path))
    if (missing.length > 0) throw new Error(`No such file in the draft: ${missing.join(", ")}.`)
    const wanted = new Set(input.paths ?? texts.keys())
    return {
      draftId: input.draftId,
      role: ticket.role,
      readOnly,
      entry: entryFile(Object.fromEntries(texts)),
      files: [...texts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, text]) => {
          const file: SourceFile = { path, hash: hashText(text), length: text.length }
          if (wanted.has(path)) file.text = text
          return file
        }),
    }
  })
}

/** The smallest splice turning `before` into `after` at `offset`: unchanged text around it keeps its identity. */
function splice(path: string, offset: number, before: string, after: string): Splice {
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return {
    path,
    index: offset + prefix,
    remove: before.length - prefix - suffix,
    insert: after.slice(prefix, after.length - suffix),
  }
}

function occurrences(text: string, needle: string) {
  const found: number[] = []
  for (let index = text.indexOf(needle); index !== -1; index = text.indexOf(needle, index + needle.length))
    found.push(index)
  return found
}

const NOTHING_CHANGED = "Nothing was changed:"

/**
 * Checks every change against the text as synced and turns it into steps, all before touching the document: a call
 * applies all of its changes or none.
 */
async function plan(draftId: string, initial: Map<string, string>, changes: readonly SourceChange[]) {
  const texts = new Map(initial)
  const entry = entryFile(Object.fromEntries(initial))
  const steps: Step[] = []
  let sources: string[] | null = null
  // Typed so TypeScript narrows after a call: it never returns.
  const fail: (message: string) => never = (message) => {
    throw new Error(`${NOTHING_CHANGED} ${message}`)
  }
  const current = (path: string) => texts.get(path) ?? fail(`there is no file ${path} (read the source again).`)
  const apply = (step: Splice) => {
    const text = current(step.path)
    if (step.remove === 0 && step.insert === "") return
    texts.set(step.path, text.slice(0, step.index) + step.insert + text.slice(step.index + step.remove))
    steps.push({ kind: "splice", splice: step })
  }
  const checkHash = (path: string, baseHash: string) => {
    if (hashText(current(path)) !== baseHash)
      fail(`${path} changed since it was read (another edit, or an earlier change in this call): read it again.`)
  }

  for (const change of changes) {
    switch (change.action) {
      case "edit":
        for (const edit of change.edits) {
          const text = current(change.path)
          const found = occurrences(text, edit.old)
          if (found.length === 0) fail(`this text is not in ${change.path} (read it again): ${edit.old.slice(0, 200)}`)
          if (found.length > 1 && !edit.replaceAll)
            fail(
              `this text occurs ${found.length} times in ${change.path}; add context to make it unique, or set replaceAll: ${edit.old.slice(0, 200)}`
            )
          // From the last occurrence, so the earlier ones' offsets stay valid.
          for (const index of found.reverse()) apply(splice(change.path, index, edit.old, edit.new))
        }
        break
      case "write":
        checkHash(change.path, change.baseHash)
        apply(splice(change.path, 0, current(change.path), change.content))
        break
      case "create": {
        if (texts.has(change.path)) fail(`${change.path} already exists.`)
        const bare = change.path.slice(change.path.lastIndexOf("/") + 1).replace(/\.tex$/, "")
        if (!change.path.endsWith(".tex") || !FILE_NAME.test(bare))
          fail(`${change.path}: a new file is a .tex file named with letters, digits, - and _.`)
        sources ??= (await getDraftFiles({ data: { draftId } })).sources
        if (!allowedPath(change.path, sources))
          fail(`${change.path} is outside the document's source folders (${sources.join(", ")}).`)
        texts.set(change.path, change.content)
        steps.push({ kind: "create", path: change.path, text: change.content })
        if (change.include) {
          if (!entry) fail("the draft has no main file (with \\documentclass) to include the new file in.")
          const insertion = inputInsertion(current(entry), change.path)
          if (!insertion) fail(`${entry} has neither an \\input nor \\end{document} to include ${change.path} after.`)
          apply({ path: entry, index: insertion.offset, remove: 0, insert: insertion.text })
        }
        break
      }
      case "delete":
        if (change.path === entry) fail(`${change.path} is the main file, which can't be deleted.`)
        checkHash(change.path, change.baseHash)
        // As "Elimina il file": the lines that include it go too.
        for (const [other, text] of texts) {
          if (other === change.path) continue
          for (const range of inputLinesOf(text, change.path))
            apply({ path: other, index: range.from, remove: range.to - range.from, insert: "" })
        }
        texts.delete(change.path)
        steps.push({ kind: "delete", path: change.path })
        break
    }
  }
  return { steps, texts }
}

export async function editSource(input: z.output<typeof editSourceInput>) {
  return withDraft(input.draftId, async (session) => {
    if (session.readOnly)
      throw new Error(
        `${NOTHING_CHANGED} the text is read-only for this account (role ${session.ticket.role}, or the draft's state isn't editable).`
      )
    const { steps, texts } = await plan(input.draftId, textsOf(session.files), input.changes)
    if (steps.length > 0) {
      session.provider.document.transact(() => {
        for (const step of steps) {
          if (step.kind === "create") session.files.set(step.path, new Y.Text(step.text))
          else if (step.kind === "delete") session.files.delete(step.path)
          else {
            const text = session.files.get(step.splice.path)
            if (!text) throw new Error(`${step.splice.path} disappeared while editing.`)
            if (step.splice.remove > 0) text.delete(step.splice.index, step.splice.remove)
            if (step.splice.insert) text.insert(step.splice.index, step.splice.insert)
          }
        }
      })
      await session.acknowledged()
    }
    // What the service holds now: others' concurrent edits, merged, included.
    const after = textsOf(session.files)
    const touched = [...new Set(input.changes.map((change) => change.path))]
    return {
      draftId: input.draftId,
      changed: steps.length > 0,
      files: touched.map((path) => {
        const text = after.get(path)
        return text === undefined
          ? { path, deleted: true }
          : { path, hash: hashText(text), length: text.length, mergedWithOthers: text !== texts.get(path) }
      }),
    }
  })
}

/** Base64 of a Yjs relative position, as the editor anchors comments. */
function encodePosition(text: Y.Text, index: number, assoc: number) {
  return Buffer.from(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, index, assoc))).toString(
    "base64"
  )
}

export async function commentOnText(input: z.output<typeof commentOnTextInput>) {
  const anchor = await withDraft(input.draftId, ({ files }) => {
    const text = files.get(input.file)
    if (!text) throw new Error(`No such file in the draft: ${input.file}.`)
    const found = occurrences(text.toJSON(), input.quote)
    if (found.length === 0) throw new Error(`The text is not in ${input.file}: read the source again.`)
    if (found.length > 1 && input.occurrence === undefined)
      throw new Error(`The text occurs ${found.length} times in ${input.file}: pass occurrence, or a longer quote.`)
    const index = found[(input.occurrence ?? 1) - 1]
    if (index === undefined) throw new Error(`The text occurs only ${found.length} times in ${input.file}.`)
    // As the editor: the start sticks to the text after it, the end to the text before it.
    return {
      file: input.file,
      start: encodePosition(text, index, 0),
      end: encodePosition(text, index + input.quote.length, -1),
    }
  })
  return createComment({ data: { draftId: input.draftId, anchor, quote: input.quote, body: input.body } })
}

/** Operations of their own (not one server function each): they reach the text through `issueCollabTicket`. */
export const regulationsSourceOperations: Operation[] = [
  {
    name: "regulations.drafts.readSource",
    kind: "read",
    guard: "regulationsAssigneeMiddleware",
    input: readSourceInput,
    description:
      "A draft's live LaTeX source from the collab service, as editors see it: each file's path, SHA-256 hash and text (only `paths` if given), the main file, and whether this account may edit it.",
    run: (data) => readSource(readSourceInput.parse(data)),
  },
  {
    name: "regulations.drafts.editSource",
    kind: "write",
    guard: "regulationsAssigneeMiddleware",
    input: editSourceInput,
    description:
      "Edit a draft's live LaTeX like the editor (draft editors, editable states only): exact-text replacements, whole-file writes, new or deleted files; hashes from readSource. All or nothing; merges with others' typing.",
    run: (data) => editSource(editSourceInput.parse(data)),
  },
  {
    name: "regulations.comments.createOnText",
    kind: "write",
    guard: "regulationsAssigneeMiddleware",
    input: commentOnTextInput,
    description:
      "Comment on an exact piece of a draft's source (from readSource), anchored as the editor anchors a selection. Commenters and editors of the draft.",
    run: (data) => commentOnText(commentOnTextInput.parse(data)),
  },
]
