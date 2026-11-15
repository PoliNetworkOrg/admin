import { useServerFn } from "@tanstack/react-start"
import { CheckCheck, MessageSquare, RotateCcw, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
  ConfirmDialog,
  fieldControl,
  IconButton,
  InlineAlert,
  LoadingButton,
  SegmentedControl,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  createComment,
  deleteComment,
  reopenComment,
  replyComment,
  resolveComment,
} from "../regulations-editor.functions"
import { formatDayTime } from "../regulations-format"
import { failureMessage } from "../regulations-hooks"
import type { CommentThread } from "../regulations.contract"
import { getComments } from "../regulations.functions"

/** The text selected for a new comment, with its anchor in the file's `Y.Text`. */
export type PendingAnchor = { file: string; start: string; end: string; quote: string }

const REFRESH_MS = 15_000

/** The draft's comment threads, reloaded every few seconds and after every change. */
export function useCommentThreads(draftId: string) {
  const load = useServerFn(getComments)
  const [threads, setThreads] = useState<CommentThread[] | null>(null)
  const [failed, setFailed] = useState(false)
  const refresh = useCallback(async () => {
    try {
      setThreads(await load({ data: { draftId } }))
      setFailed(false)
    } catch (error) {
      console.error(error)
      setFailed(true)
    }
  }, [draftId, load])
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [refresh])
  return { threads, failed, refresh }
}

/**
 * Comments on ranges of the text: threads with replies, resolved or open. No mentions. Commenters and editors write;
 * anyone deletes their own comments, the Direttivo any.
 */
export function CommentsPanel({
  draftId,
  threads,
  failed,
  refresh,
  canComment,
  canModerate,
  viewerId,
  pending,
  onCancelPending,
  activeId,
  onSelect,
  orphaned,
  onClose,
}: {
  draftId: string
  threads: CommentThread[] | null
  failed: boolean
  refresh: () => Promise<void>
  canComment: boolean
  canModerate: boolean
  viewerId: string
  pending: PendingAnchor | null
  onCancelPending: () => void
  activeId: string | null
  onSelect: (thread: CommentThread) => void
  /** Threads whose text was deleted: shown with their quote only. */
  orphaned: Set<string>
  onClose: () => void
}) {
  const create = useServerFn(createComment)
  const reply = useServerFn(replyComment)
  const resolve = useServerFn(resolveComment)
  const reopen = useServerFn(reopenComment)
  const remove = useServerFn(deleteComment)
  const [filter, setFilter] = useState<"open" | "resolved">("open")
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; reply: boolean } | null>(null)

  const open = threads?.filter((thread) => thread.resolvedAt === null) ?? []
  const resolved = threads?.filter((thread) => thread.resolvedAt !== null) ?? []
  const shown = filter === "open" ? open : resolved

  async function submitNew() {
    if (!pending || !body.trim()) return
    setSaving(true)
    setError(null)
    try {
      await create({
        data: {
          draftId,
          anchor: { file: pending.file, start: pending.start, end: pending.end },
          quote: pending.quote.slice(0, 2000),
          body: body.trim(),
        },
      })
      setBody("")
      onCancelPending()
      setFilter("open")
      await refresh()
    } catch (caught) {
      console.error(caught)
      setError(failureMessage(caught, "Non è stato possibile aggiungere il commento."))
    } finally {
      setSaving(false)
    }
  }

  async function act<T>(run: () => Promise<T>, failure: string) {
    try {
      await run()
      await refresh()
    } catch (caught) {
      console.error(caught)
      appToast.error(failureMessage(caught, failure))
    }
  }

  return (
    <section
      aria-label="Commenti"
      className="flex min-h-0 flex-col overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-(--pn-line) pr-1 pl-3">
        <h2 className="flex-1 text-[15px] font-semibold">Commenti</h2>
        <IconButton label="Chiudi i commenti" icon={X} onClick={onClose} />
      </header>
      <div className="flex shrink-0 flex-col gap-3 border-b border-(--pn-line) p-3">
        <SegmentedControl
          label="Mostra"
          value={filter}
          onValueChange={setFilter}
          items={[
            { value: "open", label: "Aperti", count: open.length },
            { value: "resolved", label: "Risolti", count: resolved.length },
          ]}
        />
        {pending ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void submitNew()
            }}
          >
            <blockquote className="line-clamp-3 border-l-2 border-(--pn-warning-solid) pl-2 text-[13px] text-(--pn-fg-muted)">
              {pending.quote}
            </blockquote>
            <label htmlFor="new-comment" className="sr-only">
              Nuovo commento
            </label>
            <Textarea
              id="new-comment"
              autoFocus
              value={body}
              maxLength={5000}
              placeholder="Scrivi un commento…"
              className={cn(fieldControl, "min-h-20")}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  void submitNew()
                }
                if (event.key === "Escape") onCancelPending()
              }}
            />
            {error ? <InlineAlert>{error}</InlineAlert> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancelPending}>
                Annulla
              </Button>
              <LoadingButton type="submit" pending={saving} disabled={!body.trim()}>
                Commenta
              </LoadingButton>
            </div>
          </form>
        ) : canComment ? (
          <p className="text-[12px] text-(--pn-fg-muted)">
            Seleziona del testo e scegli Commenta per aprire una discussione.
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {failed && threads === null ? (
          <div className="p-3">
            <InlineAlert
              action={
                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  Riprova
                </Button>
              }
            >
              Non è stato possibile caricare i commenti.
            </InlineAlert>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <MessageSquare aria-hidden className="size-5 text-(--pn-fg-muted)" />
            <p className="text-[14px] font-medium">
              {filter === "open" ? "Nessun commento aperto" : "Nessun commento risolto"}
            </p>
            <p className="text-[13px] text-(--pn-fg-muted)">
              {filter === "open" ? "I commenti sul testo compariranno qui." : "Le discussioni risolte restano qui."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {shown.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                active={thread.id === activeId}
                orphaned={orphaned.has(thread.id)}
                canComment={canComment}
                canDelete={(id) => canModerate || id === viewerId}
                onSelect={() => onSelect(thread)}
                onReply={(text) =>
                  act(() => reply({ data: { commentId: thread.id, body: text } }), "Non è stato possibile rispondere.")
                }
                onResolve={() =>
                  act(
                    () => (thread.resolvedAt ? reopen : resolve)({ data: { commentId: thread.id } }),
                    thread.resolvedAt
                      ? "Non è stato possibile riaprire il commento."
                      : "Non è stato possibile risolvere il commento."
                  )
                }
                onDelete={(id, isReply) => setDeleting({ id, reply: isReply })}
              />
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title={deleting?.reply ? "Eliminare la risposta?" : "Eliminare il commento?"}
        description={
          deleting?.reply
            ? "La risposta sparisce dalla discussione."
            : "La discussione e le sue risposte spariscono per tutti."
        }
        cancelLabel="Annulla"
        confirmLabel="Elimina"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove({ data: { commentId: deleting.id } })
          } catch (caught) {
            console.error(caught)
            throw new Error(failureMessage(caught, "Non è stato possibile eliminare il commento."), { cause: caught })
          }
          await refresh()
        }}
      />
    </section>
  )
}

function ThreadItem({
  thread,
  active,
  orphaned,
  canComment,
  canDelete,
  onSelect,
  onReply,
  onResolve,
  onDelete,
}: {
  thread: CommentThread
  active: boolean
  orphaned: boolean
  canComment: boolean
  canDelete: (authorId: string) => boolean
  onSelect: () => void
  onReply: (body: string) => Promise<void>
  onResolve: () => Promise<void>
  onDelete: (id: string, reply: boolean) => void
}) {
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!draft.trim()) return
    setSending(true)
    await onReply(draft.trim())
    setDraft("")
    setSending(false)
  }

  return (
    <li className={cn("flex flex-col gap-2 border-b border-(--pn-line) px-3 py-3", active && "bg-(--pn-accent-soft)")}>
      <button
        type="button"
        onClick={onSelect}
        className="rounded-(--pn-r-2) text-left"
        aria-label={`Mostra nel testo: ${thread.quote}`}
      >
        <blockquote
          className={cn(
            "line-clamp-2 border-l-2 pl-2 text-[13px]",
            orphaned
              ? "border-(--pn-line-strong) text-(--pn-fg-subtle) line-through"
              : "border-(--pn-warning-solid) text-(--pn-fg-muted)"
          )}
        >
          {thread.quote}
        </blockquote>
        {orphaned ? (
          <span className="mt-1 block text-[12px] text-(--pn-fg-muted)">Il testo commentato è stato eliminato.</span>
        ) : null}
      </button>
      <Message message={thread} canDelete={canDelete(thread.author.id)} onDelete={() => onDelete(thread.id, false)} />
      {thread.replies.map((message) => (
        <div key={message.id} className="ml-3 border-l border-(--pn-line) pl-3">
          <Message
            message={message}
            canDelete={canDelete(message.author.id)}
            onDelete={() => onDelete(message.id, true)}
          />
        </div>
      ))}
      {thread.resolvedAt && thread.resolvedBy ? (
        <p className="text-[12px] text-(--pn-fg-muted)">
          Risolto da {thread.resolvedBy.name} il {formatDayTime(thread.resolvedAt)}
        </p>
      ) : null}
      {canComment ? (
        <div className="flex flex-col gap-2">
          {active && !thread.resolvedAt ? (
            <>
              <label htmlFor={`reply-${thread.id}`} className="sr-only">
                Rispondi
              </label>
              <Textarea
                id={`reply-${thread.id}`}
                value={draft}
                maxLength={5000}
                placeholder="Rispondi…"
                className={cn(fieldControl, "min-h-16")}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    void send()
                  }
                }}
              />
            </>
          ) : null}
          <div className="flex items-center justify-end gap-1">
            <LoadingButton
              variant="ghost"
              icon={thread.resolvedAt ? RotateCcw : CheckCheck}
              pending={busy}
              onClick={async () => {
                setBusy(true)
                await onResolve()
                setBusy(false)
              }}
            >
              {thread.resolvedAt ? "Riapri" : "Risolvi"}
            </LoadingButton>
            {active && !thread.resolvedAt ? (
              <LoadingButton pending={sending} disabled={!draft.trim()} onClick={() => void send()}>
                Rispondi
              </LoadingButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

function Message({
  message,
  canDelete,
  onDelete,
}: {
  message: { id: string; author: { name: string }; body: string; createdAt: string; deleted: boolean }
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium">{message.author.name}</span>
        <span className="shrink-0 text-[12px] text-(--pn-fg-muted) tabular-nums">
          {formatDayTime(message.createdAt)}
        </span>
        <span className="flex-1" />
        {canDelete && !message.deleted ? (
          <IconButton label="Elimina" icon={Trash2} tone="danger" className="-my-1.5" onClick={onDelete} />
        ) : null}
      </div>
      <p className="text-[14px] break-words whitespace-pre-wrap">
        {message.deleted ? <span className="text-(--pn-fg-muted)">Commento eliminato.</span> : message.body}
      </p>
    </div>
  )
}
