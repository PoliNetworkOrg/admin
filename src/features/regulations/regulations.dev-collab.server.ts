import { spawn } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, normalize } from "node:path"

import { Server } from "@hocuspocus/server"
import * as Y from "yjs"

import type { CompileStatus, Files } from "./regulations.contract"
import { FAKE_CLASS, FAKE_FONTS_DIR } from "./regulations.fixtures.server"

/**
 * Agent mode's stand-ins for the collab service and the compile worker, inside the dev server: a Hocuspocus server
 * (one `Y.Text` per source file in the `files` map, as the real one) that accepts the fake's tickets, and xelatex run
 * on the machine, 1.5 s after the last edit, one compile per draft at a time, cached by source hash. Development only:
 * no sandbox, which the real worker has.
 */

type Role = "editor" | "commenter" | "viewer"
type Ticket = { draftId: string; role: Role; readOnly: boolean; expiresAt: number }
type CompileError = CompileStatus["errors"][number]
/** What the collab service tells a draft's connections, as JSON. */
type StatelessMessage =
  | { type: "compile"; state: CompileStatus["state"]; hash: string }
  | { type: "state"; state: string }
type CompileState = {
  status: CompileStatus
  pdfs: Map<string, Buffer>
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
  again: boolean
}

export type DevCollabHooks = {
  /** The text a draft starts from the first time its document loads. */
  initialFiles: (draftId: string) => Files | null
  /** The draft's entry file. */
  entry: (draftId: string) => string
  /** The document was loaded: the fake anchors its sample comments in it. */
  onLoaded: (draftId: string, document: Y.Doc) => void
  /** Every change, so the fake's snapshots, merges and diffs see the current text. */
  onFiles: (draftId: string, files: Files) => void
}

export type DevCollab = {
  url: string
  issueTicket: (draftId: string, role: Role, readOnly: boolean) => { ticket: string; expiresAt: string }
  /** Replaces every file's text in one transaction, as a restore or a merge does. */
  replaceFiles: (draftId: string, files: Files) => Promise<void>
  compileStatus: (draftId: string) => CompileStatus
  pdf: (draftId: string, hash: string) => Buffer | null
  /** A one-off compile (a published version's PDF), cached by source hash. */
  compileOnce: (key: string, entry: string, files: Files) => Promise<Buffer>
  /** `{ type: "state" }`: the draft changed state (frozen or not); editors get a new ticket and reconnect. */
  notifyState: (draftId: string, state: string) => void
}

const TICKET_TTL_MS = 60_000
const COMPILE_DEBOUNCE_MS = 1500
const COMPILE_TIMEOUT_MS = 60_000

type Global = typeof globalThis & { __regulationsDevCollab?: Promise<DevCollab> }

export function devCollab(hooks: DevCollabHooks): Promise<DevCollab> {
  // SAFETY: `Global` only adds an optional property to `globalThis`.
  const holder = globalThis as Global
  holder.__regulationsDevCollab ??= start(hooks)
  return holder.__regulationsDevCollab
}

export function filesOf(document: Y.Doc): Files {
  const files = document.getMap<Y.Text>("files")
  return Object.fromEntries([...files.entries()].map(([path, text]) => [path, text.toString()]))
}

export function hashFiles(files: Files) {
  const hash = createHash("sha256")
  for (const path of Object.keys(files).sort()) hash.update(path).update("\0").update(files[path]).update("\0")
  return hash.digest("hex")
}

async function start(hooks: DevCollabHooks): Promise<DevCollab> {
  const port = Number(process.env.REGULATIONS_DEV_COLLAB_PORT ?? Number(process.env.PORT ?? 3001) + 1)
  const tickets = new Map<string, Ticket>()
  const compiles = new Map<string, CompileState>()
  const once = new Map<string, Buffer>()
  /** Each draft's Yjs state, kept across unloads. */
  const states = new Map<string, Uint8Array>()

  const compileState = (draftId: string) => {
    let state = compiles.get(draftId)
    if (!state) {
      state = {
        status: { state: "idle", hash: null, lastGoodHash: null, compiledAt: null, errors: [], log: null },
        pdfs: new Map(),
        timer: null,
        running: false,
        again: false,
      }
      compiles.set(draftId, state)
    }
    return state
  }

  const server = new Server({
    port,
    quiet: true,
    async onAuthenticate({ token, documentName, connectionConfig }) {
      const ticket = tickets.get(token)
      tickets.delete(token)
      if (!ticket || ticket.draftId !== documentName || ticket.expiresAt < Date.now())
        throw new Error("Ticket non valido")
      connectionConfig.readOnly = ticket.readOnly
      return { role: ticket.role }
    },
    async onLoadDocument({ document, documentName }) {
      const files = document.getMap<Y.Text>("files")
      if (files.size > 0) return document
      // Hocuspocus unloads a document once nobody is connected: reload its Yjs state, as the real service does from
      // Postgres, so comment anchors (relative positions) keep pointing at the same text.
      const stored = states.get(documentName)
      if (stored) {
        Y.applyUpdate(document, stored)
        return document
      }
      const initial = hooks.initialFiles(documentName)
      if (initial)
        document.transact(() => {
          for (const [path, text] of Object.entries(initial)) files.set(path, new Y.Text(text))
        })
      return document
    },
    async afterLoadDocument({ document, documentName }) {
      hooks.onLoaded(documentName, document)
      states.set(documentName, Y.encodeStateAsUpdate(document))
      scheduleCompile(documentName, document, 0)
    },
    async onStoreDocument({ document, documentName }) {
      states.set(documentName, Y.encodeStateAsUpdate(document))
    },
    async onChange({ document, documentName }) {
      states.set(documentName, Y.encodeStateAsUpdate(document))
      hooks.onFiles(documentName, filesOf(document))
      scheduleCompile(documentName, document, COMPILE_DEBOUNCE_MS)
    },
  })
  await server.listen()

  function broadcast(draftId: string, payload: StatelessMessage) {
    server.hocuspocus.documents.get(draftId)?.broadcastStateless(JSON.stringify(payload))
  }

  function scheduleCompile(draftId: string, document: Y.Doc, delay: number) {
    const state = compileState(draftId)
    if (state.timer) clearTimeout(state.timer)
    state.timer = setTimeout(() => {
      state.timer = null
      void runCompile(draftId, filesOf(document))
    }, delay)
  }

  async function runCompile(draftId: string, files: Files) {
    const state = compileState(draftId)
    if (state.running) {
      state.again = true
      return
    }
    const hash = hashFiles(files)
    if (state.pdfs.has(hash)) {
      state.status = { ...state.status, state: "ok", hash, lastGoodHash: hash, errors: [] }
      broadcast(draftId, { type: "compile", state: "ok", hash })
      return
    }
    state.running = true
    state.status = { ...state.status, state: "running", hash }
    broadcast(draftId, { type: "compile", state: "running", hash })
    try {
      const { pdf, errors, log } = await xelatex(draftId, hooks.entry(draftId), files)
      const compiledAt = new Date().toISOString()
      if (pdf) {
        state.pdfs.set(hash, pdf)
        state.status = { state: "ok", hash, lastGoodHash: hash, compiledAt, errors, log }
      } else state.status = { ...state.status, state: "error", hash, compiledAt, errors, log }
    } catch (error) {
      console.error(error)
      state.status = {
        ...state.status,
        state: "error",
        hash,
        errors: [{ file: null, line: null, message: String(error) }],
      }
    } finally {
      state.running = false
    }
    broadcast(draftId, { type: "compile", state: state.status.state, hash })
    if (state.again) {
      state.again = false
      const document = server.hocuspocus.documents.get(draftId)
      if (document) scheduleCompile(draftId, document, 0)
    }
  }

  return {
    url: `ws://localhost:${port}`,
    issueTicket(draftId, role, readOnly) {
      const ticket = randomBytes(24).toString("base64url")
      const expiresAt = Date.now() + TICKET_TTL_MS
      tickets.set(ticket, { draftId, role, readOnly, expiresAt })
      return { ticket, expiresAt: new Date(expiresAt).toISOString() }
    },
    async replaceFiles(draftId, next) {
      const connection = await server.hocuspocus.openDirectConnection(draftId, {})
      try {
        await connection.transact((document) => {
          const files = document.getMap<Y.Text>("files")
          for (const path of [...files.keys()]) if (!(path in next)) files.delete(path)
          for (const [path, text] of Object.entries(next)) {
            const current = files.get(path)
            if (!current) files.set(path, new Y.Text(text))
            else if (current.toString() !== text) {
              current.delete(0, current.length)
              current.insert(0, text)
            }
          }
        })
      } finally {
        await connection.disconnect()
      }
    },
    compileStatus: (draftId) => compileState(draftId).status,
    pdf: (draftId, hash) => compileState(draftId).pdfs.get(hash) ?? null,
    async compileOnce(key, entry, files) {
      const hash = hashFiles(files)
      const cached = once.get(hash)
      if (cached) return cached
      const { pdf, errors } = await xelatex(key, entry, files)
      if (!pdf) throw new Error(errors[0]?.message ?? "xelatex non ha prodotto il PDF")
      once.set(hash, pdf)
      return pdf
    },
    notifyState: (draftId, state) => broadcast(draftId, { type: "state", state }),
  }
}

async function xelatex(draftId: string, entry: string, files: Files) {
  const workdir = join(tmpdir(), "pn-regulations-dev", draftId.replace(/[^\w-]/g, "_"))
  await mkdir(workdir, { recursive: true })
  for (const [name, text] of Object.entries(files)) {
    const path = normalize(name)
    if (path.startsWith("..") || path.startsWith("/")) continue
    await mkdir(dirname(join(workdir, path)), { recursive: true })
    await writeFile(join(workdir, path), text)
  }
  await writeFile(join(workdir, "polinetwork-regolamento.cls"), FAKE_CLASS)
  // The real class loads its fonts from `fonts/` next to the main file.
  if (FAKE_FONTS_DIR && !existsSync(join(workdir, "fonts"))) await symlink(FAKE_FONTS_DIR, join(workdir, "fonts"))
  const log = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      "xelatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", entry],
      { cwd: workdir, timeout: COMPILE_TIMEOUT_MS, env: { ...process.env, openin_any: "p", openout_any: "p" } }
    )
    let output = ""
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()))
    child.on("error", reject)
    child.on("close", () => resolve(output))
  })
  const errors: CompileError[] = [...log.matchAll(/^(?:\.\/)?([^\s:][^:\n]*\.tex):(\d+): (.+)$/gm)].map((match) => ({
    file: match[1],
    line: Number(match[2]),
    message: match[3],
  }))
  const tail = log.split("\n").slice(-40).join("\n")
  if (errors.length > 0) return { pdf: null, errors, log: tail }
  try {
    const pdf = await readFile(join(workdir, entry.replace(/\.tex$/, ".pdf")))
    return { pdf, errors, log: tail }
  } catch (error) {
    console.error(error)
    return { pdf: null, errors: [{ file: null, line: null, message: "xelatex non ha prodotto il PDF" }], log: tail }
  }
}
