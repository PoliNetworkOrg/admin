import type { Diagnostic } from "@codemirror/lint"
import { getRouteApi, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ChevronDown, CircleAlert, History, MessageSquarePlus, MessagesSquare, Share2, Workflow } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type * as Y from "yjs"

import {
  AvatarGroup,
  buttonMotion,
  Hint,
  IconButton,
  InlineAlert,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  SegmentedControl,
  Spinner,
} from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { useFillHeight } from "@/features/esign/use-fill-height"
import { cn } from "@/lib/utils"

import { parseDocument, type StructureNode } from "../latex-structure"
import { MembersDialog } from "../members-dialog"
import { DraftKindMark, DraftStateBadge } from "../regulations-ui"
import type {
  Assignment,
  CommentThread,
  CompileStatus,
  Draft,
  Files,
  Snapshot,
  ValidationIssue,
} from "../regulations.contract"
import { getCompileStatus, getDraftFiles, getDraftPdf } from "../regulations.functions"
import { type CodeEditorHandle, CodeEditor, type EditorMode } from "./code-editor"
import { type CommentRange, encodePosition, resolveAnchor } from "./comment-marks"
import { CommentsPanel, type PendingAnchor, useCommentThreads } from "./comments-panel"
import { HistoryPanel, SnapshotCompare } from "./history-panel"
import { PdfPane } from "./pdf-pane"
import { EditorSidebar } from "./sidebar"
import { type CollabMessage, useCollab } from "./use-collab"

const dashboardRoute = getRouteApi("/dashboard")
const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

const STATUS_POLL_BUSY_MS = 3000
const STATUS_POLL_IDLE_MS = 15_000
const MODE_KEY = "regulations-editor-mode"

type Panel = "comments" | "history" | null

/**
 * The draft editor, Overleaf-style: the source files and the open file's outline, the text (LaTeX source, or the
 * visual mode over the same text) edited together through Yjs, and the live PDF preview from the compile worker. Side
 * panels hold the comments and the history; a snapshot opens side by side with the current text.
 */
export function EditorPage({ draft, members }: { draft: Draft; members: Assignment[] }) {
  const router = useRouter()
  const user = dashboardRoute.useRouteContext({ select: (context) => context.user })
  const loadStatus = useServerFn(getCompileStatus)
  const loadPdf = useServerFn(getDraftPdf)
  const loadFiles = useServerFn(getDraftFiles)

  const [compile, setCompile] = useState<CompileStatus | null>(null)
  const [pdf, setPdf] = useState<{ hash: string; bytes: Uint8Array } | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const refreshCompile = useCallback(async () => {
    try {
      setCompile(await loadStatus({ data: { draftId: draft.id } }))
    } catch (error) {
      console.error(error)
    }
  }, [draft.id, loadStatus])
  const refreshIssues = useCallback(async () => {
    try {
      setIssues((await loadFiles({ data: { draftId: draft.id } })).structure.issues)
    } catch (error) {
      console.error(error)
    }
  }, [draft.id, loadFiles])

  const onMessage = useCallback(
    (message: CollabMessage) => {
      if (message.type === "compile") {
        void refreshCompile()
        if (message.state !== "running" && message.state !== "queued") void refreshIssues()
      } else {
        // Frozen or unfrozen: useCollab reconnects with a new ticket; the page reloads what the draft allows now.
        router.invalidate().catch((error) => console.error(error))
      }
    },
    [refreshCompile, refreshIssues, router]
  )
  const collab = useCollab({ draftId: draft.id, state: draft.state, user, onMessage })
  const readOnly = collab.readOnly || !draft.can.edit

  // Compile status: the server's messages drive it; polling is the fallback, faster while a compile runs.
  const busy = compile?.state === "queued" || compile?.state === "running"
  useEffect(() => {
    void refreshCompile()
    void refreshIssues()
  }, [refreshCompile, refreshIssues])
  useEffect(() => {
    const timer = setInterval(
      () => {
        void refreshCompile()
        if (!busy) void refreshIssues()
      },
      busy ? STATUS_POLL_BUSY_MS : STATUS_POLL_IDLE_MS
    )
    return () => clearInterval(timer)
  }, [busy, refreshCompile, refreshIssues])

  // The last good PDF stays until a newer one has arrived, whatever the latest compile did.
  const lastGood = compile?.lastGoodHash ?? null
  useEffect(() => {
    if (!lastGood || pdf?.hash === lastGood) return
    let current = true
    loadPdf({ data: { draftId: draft.id, hash: lastGood } }).then(
      (file) => {
        if (current) setPdf({ hash: lastGood, bytes: Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0)) })
      },
      (error) => console.error(error)
    )
    return () => {
      current = false
    }
  }, [draft.id, lastGood, loadPdf, pdf?.hash])

  // The text changes under us (others type): a revision counter refreshes outline, references and comment anchors.
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const document = collab.document
    if (!document) return
    let frame = 0
    const bump = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRevision((value) => value + 1))
    }
    document.on("update", bump)
    return () => {
      cancelAnimationFrame(frame)
      document.off("update", bump)
    }
  }, [collab.document])

  const textOf = useCallback(
    (path: string): Y.Text | null => collab.document?.getMap<Y.Text>("files").get(path) ?? null,
    [collab.document]
  )
  const currentFiles = useCallback((): Files => {
    const map = collab.document?.getMap<Y.Text>("files")
    return map ? Object.fromEntries([...map.entries()].map(([path, text]) => [path, text.toJSON()])) : {}
  }, [collab.document])

  const [path, setPath] = useState<string | null>(null)
  useEffect(() => {
    if (path && collab.files.includes(path)) return
    if (!collab.synced || collab.files.length === 0) return
    // Open the first file with articles; the entry file is mostly preamble.
    setPath(
      collab.files.find((file) => /\\(regolamento|articolo)\b/.test(textOf(file)?.toJSON() ?? "")) ?? collab.files[0]
    )
  }, [collab.files, collab.synced, path, textOf])
  const text = path ? textOf(path) : null

  // The whole document, as the PDF numbers it: `\input` files continue the numbering of the file that inputs them.
  const parseAll = useCallback(() => {
    const files = currentFiles()
    return parseDocument(files, entryFile(files)).nodes
  }, [currentFiles])
  const parsed = useMemo(() => {
    void revision
    void collab.files
    const all = new Map<string, StructureNode[]>()
    for (const node of parseAll()) all.set(node.file, [...(all.get(node.file) ?? []), node])
    return all
  }, [collab.files, revision, parseAll])
  const parsedRef = useRef(parsed)
  parsedRef.current = parsed
  const context = useMemo(
    () => ({
      allText: () => Object.values(currentFiles()).join("\n"),
      nodes: () => [...parsedRef.current.values()].flat(),
      nodesOf: (file: string) => ({
        text: currentFiles()[file] ?? "",
        nodes: parseAll().filter((node) => node.file === file),
      }),
    }),
    [currentFiles, parseAll]
  )

  const [mode, setMode] = useState<EditorMode>("source")
  useEffect(() => {
    const saved = sessionStorage.getItem(MODE_KEY)
    if (saved === "visual" || saved === "source") setMode(saved)
  }, [])
  const changeMode = (next: EditorMode) => {
    setMode(next)
    sessionStorage.setItem(MODE_KEY, next)
  }

  // Problems: the parser's (positions in the saved text) and the compiler's (lines), for the open file.
  const diagnostics = useMemo<Diagnostic[]>(() => {
    if (!path || !text) return []
    const content = text.toJSON()
    const fromParser: Diagnostic[] = issues
      .filter((issue) => issue.file === path)
      .map((issue) => ({
        from: issue.offset,
        to: Math.max(issue.offset, issue.endOffset),
        severity: issue.severity,
        message: issue.message,
      }))
    const lines = content.split("\n")
    const fromCompiler: Diagnostic[] =
      compile?.state === "error"
        ? compile.errors.flatMap((error) => {
            if (error.file !== path || !error.line || error.line > lines.length) return []
            const from = lines.slice(0, error.line - 1).reduce((sum, line) => sum + line.length + 1, 0)
            return [
              {
                from,
                to: from + lines[error.line - 1].length,
                severity: "error" as const,
                message: `xelatex: ${error.message}`,
              },
            ]
          })
        : []
    return [...fromParser, ...fromCompiler]
    // `revision` keeps line positions current as others type.
  }, [compile, issues, path, text, revision])
  const problemsByFile = useMemo(() => {
    const counts = new Map<string, number>()
    for (const issue of issues) counts.set(issue.file, (counts.get(issue.file) ?? 0) + 1)
    if (compile?.state === "error")
      for (const error of compile.errors) if (error.file) counts.set(error.file, (counts.get(error.file) ?? 0) + 1)
    return counts
  }, [compile, issues])
  const problemCount = [...problemsByFile.values()].reduce((sum, count) => sum + count, 0)

  // Comments.
  const comments = useCommentThreads(draft.id)
  const [panel, setPanel] = useState<Panel>(null)
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null)
  const [selection, setSelection] = useState({ from: 0, to: 0 })
  const anchors = useMemo(() => {
    void revision
    const resolved = new Map<string, { file: string; from: number; to: number } | null>()
    const document = collab.document
    if (!document) return resolved
    for (const thread of comments.threads ?? []) {
      const fileText = textOf(thread.anchor.file)
      const range = fileText ? resolveAnchor(document, fileText, thread) : null
      resolved.set(thread.id, range ? { file: thread.anchor.file, ...range } : null)
    }
    return resolved
  }, [collab.document, comments.threads, revision, textOf])
  const commentRanges = useMemo<CommentRange[]>(
    () =>
      (comments.threads ?? []).flatMap((thread) => {
        const anchor = anchors.get(thread.id)
        if (!anchor || anchor.file !== path) return []
        return [
          {
            id: thread.id,
            from: anchor.from,
            to: anchor.to,
            active: thread.id === activeComment,
            resolved: thread.resolvedAt !== null,
          },
        ]
      }),
    [activeComment, anchors, comments.threads, path]
  )
  const orphaned = useMemo(
    () => new Set([...anchors].filter(([, range]) => range === null).map(([id]) => id)),
    [anchors]
  )

  function startComment() {
    if (!text || !path || selection.from === selection.to) return
    setPendingAnchor({
      file: path,
      start: encodePosition(text, selection.from, 0),
      end: encodePosition(text, selection.to, -1),
      quote: text.toJSON().slice(selection.from, selection.to),
    })
    setPanel("comments")
  }

  // Jumps (outline, comments, problems) may switch file first; the reveal waits for the new view.
  const editor = useRef<CodeEditorHandle>(null)
  const [reveal, setReveal] = useState<{ file: string; from: number; to: number } | null>(null)
  useEffect(() => {
    if (!reveal || reveal.file !== path) return
    const frame = requestAnimationFrame(() => {
      editor.current?.reveal(reveal.from, reveal.to)
      setReveal(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [path, reveal])
  function goTo(file: string, from: number, to = from) {
    setPath(file)
    setReveal({ file, from, to })
  }
  function selectThread(thread: CommentThread) {
    setActiveComment(thread.id)
    const anchor = anchors.get(thread.id)
    if (anchor) goTo(anchor.file, anchor.from, anchor.to)
  }
  function firstProblem() {
    const issue = issues[0]
    if (issue) return goTo(issue.file, issue.offset, issue.endOffset)
    const error = compile?.errors.find((candidate) => candidate.file && candidate.line)
    const lines = error?.file ? textOf(error.file)?.toJSON().split("\n") : null
    if (error?.file && error.line && lines) {
      const from = lines.slice(0, error.line - 1).reduce((sum, line) => sum + line.length + 1, 0)
      goTo(error.file, from)
    }
  }

  // History.
  const [compare, setCompare] = useState<Snapshot | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

  const [membersOpen, setMembersOpen] = useState(false)
  const fill = useFillHeight<HTMLDivElement>()
  const stateLabel = draft.procedure.states.find((state) => state.key === draft.state)?.label
  const frozen = !draft.procedure.states.find((state) => state.key === draft.state)?.editable

  function downloadPdf() {
    if (!pdf) return
    const url = URL.createObjectURL(new Blob([pdf.bytes.slice()], { type: "application/pdf" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${draft.title}.pdf`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <PageBar
        back={BACK}
        crumb="Bozze"
        context={draft.title}
        right={
          <>
            {draft.can.assign ? (
              <Button variant="outline" className={buttonMotion} onClick={() => setMembersOpen(true)}>
                <Share2 aria-hidden data-icon="inline-start" />
                Condividi
              </Button>
            ) : null}
            <Button
              variant="outline"
              className={buttonMotion}
              nativeButton={false}
              render={<Link to="/dashboard/regulations/drafts/$draftId/procedure" params={{ draftId: draft.id }} />}
            >
              <Workflow aria-hidden data-icon="inline-start" />
              Procedura
            </Button>
          </>
        }
      />
      <PageContent fill>
        <div className="@container/editor flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
              <h1 className="min-w-0 truncate text-[22px]/8 font-semibold tracking-[-0.01em]">{draft.title}</h1>
              <DraftStateBadge state={draft.state} label={stateLabel} />
              <DraftKindMark kind={draft.kind} />
              <ConnectionState status={collab.status} />
              {collab.peers.length > 0 ? (
                <AvatarGroup
                  people={collab.peers.map((peer) => ({
                    id: peer.clientId,
                    name: peer.name,
                  }))}
                  max={5}
                  listLabel="Nell'editor ora"
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <SegmentedControl
                label="Modalità dell'editor"
                value={mode}
                onValueChange={changeMode}
                items={[
                  { value: "source", label: "Sorgente" },
                  { value: "visual", label: "Visuale" },
                ]}
              />
              {problemCount > 0 ? (
                <Hint label="Vai al primo problema">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(buttonMotion, "text-(--pn-danger-fg)")}
                    onClick={firstProblem}
                  >
                    <CircleAlert aria-hidden data-icon="inline-start" />
                    {problemCount === 1 ? "1 problema" : `${problemCount} problemi`}
                  </Button>
                </Hint>
              ) : null}
              {draft.can.comment ? (
                <IconButton
                  label="Commenta la selezione"
                  icon={MessageSquarePlus}
                  disabled={selection.from === selection.to || !text}
                  onClick={startComment}
                />
              ) : null}
              <IconButton
                label="Commenti"
                icon={MessagesSquare}
                tone={panel === "comments" ? "info" : "default"}
                aria-pressed={panel === "comments"}
                onClick={() => setPanel(panel === "comments" ? null : "comments")}
              />
              <IconButton
                label="Cronologia"
                icon={History}
                tone={panel === "history" ? "info" : "default"}
                aria-pressed={panel === "history"}
                onClick={() => {
                  setPanel(panel === "history" ? null : "history")
                  if (panel === "history") setCompare(null)
                }}
              />
            </div>
          </div>

          {frozen || readOnly ? (
            <InlineAlert tone="info">
              {frozen
                ? `La bozza è «${stateLabel ?? draft.state}»: il testo è bloccato. Si possono ancora leggere e commentare.`
                : draft.can.comment
                  ? "Puoi commentare il testo, non modificarlo."
                  : "Puoi leggere il testo, non modificarlo."}
            </InlineAlert>
          ) : null}
          {collab.status === "failed" ? (
            <InlineAlert
              action={
                <Button variant="outline" size="sm" onClick={collab.reconnect}>
                  Riprova
                </Button>
              }
            >
              Non è stato possibile collegarsi all'editor condiviso.
            </InlineAlert>
          ) : null}

          <div
            ref={(element) => {
              fill.ref(element)
              // The measured height applies only from 860px of container width (the class below); narrower, the
              // panes stack and the page scrolls.
              if (element && fill.height !== null) element.style.setProperty("--editor-fill", `${fill.height}px`)
            }}
            className="flex flex-col gap-3 @min-[860px]/editor:grid @min-[860px]/editor:h-(--editor-fill) @min-[860px]/editor:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @min-[1200px]/editor:grid-cols-[200px_minmax(0,1.1fr)_minmax(0,1fr)]"
          >
            <EditorSidebar
              files={collab.files}
              current={path}
              onOpen={setPath}
              outline={path ? (parsed.get(path) ?? []) : []}
              onReveal={(node) => path && goTo(path, node.headFrom)}
              problemsByFile={problemsByFile}
              className="hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-panel) p-1.5 @min-[1200px]/editor:flex"
            />
            <div className="flex h-[70dvh] min-h-[420px] flex-col overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface) @min-[860px]/editor:h-auto @min-[860px]/editor:min-h-0">
              {compare ? (
                <SnapshotCompare
                  snapshot={compare}
                  currentFiles={currentFiles}
                  canRestore={draft.can.restore}
                  onClose={() => setCompare(null)}
                  onRestored={() => {
                    setCompare(null)
                    setHistoryKey((value) => value + 1)
                  }}
                />
              ) : (
                <>
                  <div className="flex h-9 shrink-0 items-center gap-2 border-b border-(--pn-line) px-3 font-mono text-[12.5px] text-(--pn-fg-muted)">
                    <span className="truncate @max-[1199px]/editor:hidden">{path ?? ""}</span>
                    <FilePicker
                      files={collab.files}
                      current={path}
                      onOpen={setPath}
                      className="@min-[1200px]/editor:hidden"
                    />
                  </div>
                  {path && text && collab.document ? (
                    <CodeEditor
                      key={`${path}:${collab.document.guid}`}
                      path={path}
                      handle={editor}
                      text={text}
                      awareness={collab.provider?.awareness ?? null}
                      readOnly={readOnly}
                      mode={mode}
                      context={context}
                      diagnostics={diagnostics}
                      comments={commentRanges}
                      onSelection={setSelection}
                      onCommentClick={(id) => {
                        setActiveComment(id)
                        setPanel("comments")
                      }}
                      className="flex-1"
                    />
                  ) : (
                    <div
                      role="status"
                      className="grid flex-1 place-items-center gap-2 text-[13px] text-(--pn-fg-muted)"
                    >
                      <span className="flex items-center gap-2">
                        <Spinner /> Apertura del testo…
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex h-[80dvh] min-h-[480px] flex-col @min-[860px]/editor:h-auto @min-[860px]/editor:min-h-0">
              {panel === "comments" ? (
                <CommentsPanel
                  draftId={draft.id}
                  threads={comments.threads}
                  failed={comments.failed}
                  refresh={comments.refresh}
                  canComment={draft.can.comment}
                  canModerate={draft.can.assign}
                  viewerId={user.sub}
                  pending={pendingAnchor}
                  onCancelPending={() => setPendingAnchor(null)}
                  activeId={activeComment}
                  onSelect={selectThread}
                  orphaned={orphaned}
                  onClose={() => setPanel(null)}
                />
              ) : panel === "history" ? (
                <HistoryPanel
                  draftId={draft.id}
                  canSnapshot={draft.can.snapshot}
                  selectedId={compare?.id ?? null}
                  onSelect={setCompare}
                  reloadKey={historyKey}
                  onClose={() => {
                    setPanel(null)
                    setCompare(null)
                  }}
                />
              ) : (
                <PdfPane
                  status={compile}
                  pdf={pdf?.bytes ?? null}
                  onDownload={pdf ? downloadPdf : null}
                  className="h-full"
                />
              )}
            </div>
          </div>
        </div>
      </PageContent>
      {draft.can.assign ? (
        <MembersDialog open={membersOpen} onOpenChange={setMembersOpen} draft={draft} members={members} />
      ) : null}
    </>
  )
}

/** Below 1200px the file tree gives way to this menu in the editor's header. */
function FilePicker({
  files,
  current,
  onOpen,
  className,
}: {
  files: string[]
  current: string | null
  onOpen: (path: string) => void
  className?: string
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="ghost" size="sm" className={cn("-ml-2 h-7 gap-1 px-2 font-mono text-[12.5px]", className)} />
        }
      >
        {current ?? "File"}
        <ChevronDown aria-hidden className="size-3.5" />
      </MenuTrigger>
      <MenuContent align="start">
        <MenuRadioGroup value={current ?? ""} onValueChange={(value) => onOpen(String(value))}>
          {files.map((file) => (
            <MenuRadioItem key={file} value={file} className="font-mono text-[12.5px]">
              {file}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

function ConnectionState({ status }: { status: ReturnType<typeof useCollab>["status"] }) {
  if (status === "connected") return null
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-(--pn-fg-muted)" role="status">
      {status === "failed" ? null : <Spinner className="size-3.5" />}
      {status === "connecting" ? "Connessione…" : status === "disconnected" ? "Riconnessione…" : "Non connesso"}
    </span>
  )
}

/** The main file: the one with `\documentclass` (the RRI's `RRI.tex`). */
function entryFile(files: Files) {
  return Object.keys(files).find((file) => /\\documentclass/.test(files[file] ?? "")) ?? "RRI.tex"
}
