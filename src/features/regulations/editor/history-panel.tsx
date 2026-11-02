import { useServerFn } from "@tanstack/react-start"
import { diffLines } from "diff"
import { History, Plus, RotateCcw, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ConfirmDialog,
  fieldControl,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  Spinner,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { createSnapshot, restoreSnapshot } from "../regulations-editor.functions"
import { formatDayTime } from "../regulations-format"
import { failureMessage } from "../regulations-hooks"
import type { Files, Snapshot } from "../regulations.contract"
import { getSnapshot, getSnapshots } from "../regulations.functions"

/**
 * The draft's history, Google-Docs style: automatic snapshots while people work and at every state change, named
 * ones, and the versions restores and merges left. Any of them compares with the current text and can be restored;
 * restoring saves the current text first, so it never loses anything.
 */

export function snapshotTitle(snapshot: Snapshot) {
  switch (snapshot.kind) {
    case "base":
      return snapshot.name ?? "Creazione della bozza"
    case "auto":
      return "Salvataggio automatico"
    case "named":
      return snapshot.name ?? "Versione con nome"
    case "state":
      return snapshot.name ? `Stato: ${snapshot.name}` : "Cambio di stato"
    case "restore":
      return snapshot.name ?? "Ripristino"
    case "merge":
      return snapshot.name ?? "Prima di un'unione"
  }
}

export function HistoryPanel({
  draftId,
  canSnapshot,
  selectedId,
  onSelect,
  onClose,
  reloadKey,
}: {
  draftId: string
  canSnapshot: boolean
  selectedId: string | null
  onSelect: (snapshot: Snapshot) => void
  onClose: () => void
  /** Changes when the list should reload (after a restore). */
  reloadKey: number
}) {
  const load = useServerFn(getSnapshots)
  const save = useServerFn(createSnapshot)
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")

  const refresh = useCallback(async () => {
    try {
      setSnapshots(await load({ data: { draftId } }))
      setFailed(false)
    } catch (error) {
      console.error(error)
      setFailed(true)
    }
  }, [draftId, load])
  useEffect(() => {
    void refresh()
  }, [refresh, reloadKey])

  return (
    <section
      aria-label="Cronologia"
      className="flex min-h-0 flex-col overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-(--pn-line) pr-1 pl-3">
        <h2 className="flex-1 text-[15px] font-semibold">Cronologia</h2>
        {canSnapshot ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setName("")
              setNaming(true)
            }}
          >
            <Plus aria-hidden data-icon="inline-start" />
            Salva versione
          </Button>
        ) : null}
        <IconButton label="Chiudi la cronologia" icon={X} onClick={onClose} />
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {failed && snapshots === null ? (
          <div className="p-3">
            <InlineAlert
              action={
                <Button variant="outline" size="sm" onClick={() => void refresh()}>
                  Riprova
                </Button>
              }
            >
              Non è stato possibile caricare la cronologia.
            </InlineAlert>
          </div>
        ) : snapshots === null ? (
          <div className="grid place-items-center p-8">
            <Spinner />
          </div>
        ) : (
          <ol className="flex flex-col">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <button
                  type="button"
                  aria-pressed={snapshot.id === selectedId}
                  onClick={() => onSelect(snapshot)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-(--pn-line) px-3 py-2.5 text-left transition-[background-color] duration-120",
                    snapshot.id === selectedId ? "bg-(--pn-accent-soft)" : "hover:bg-(--pn-hover)"
                  )}
                >
                  <span className={cn("text-[14px]", snapshot.kind === "named" && "font-medium")}>
                    {snapshotTitle(snapshot)}
                  </span>
                  <span className="text-[12px] text-(--pn-fg-muted) tabular-nums">
                    {formatDayTime(snapshot.createdAt)}
                    {snapshot.createdBy ? ` · ${snapshot.createdBy.name}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <FormDialog
        open={naming}
        onOpenChange={setNaming}
        title="Salva versione"
        description="Una versione con nome resta nella cronologia, per confrontarla o ripristinarla."
        noun="versione"
        dirty={name.trim() !== ""}
        submitLabel="Salva versione"
        canSubmit={name.trim() !== ""}
        onSubmit={async () => {
          try {
            await save({ data: { draftId, name: name.trim() } })
          } catch (caught) {
            console.error(caught)
            throw new Error(failureMessage(caught, "Non è stato possibile salvare la versione."), { cause: caught })
          }
          setNaming(false)
          appToast.success("Versione salvata.")
          await refresh()
        }}
      >
        <FormField label="Nome" htmlFor="snapshot-name">
          <Input
            id="snapshot-name"
            value={name}
            maxLength={120}
            placeholder="Proposta per il Direttivo"
            className={fieldControl}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
      </FormDialog>
    </section>
  )
}

type Line = { kind: "same" | "added" | "removed"; text: string; before: number | null; after: number | null }

/** Line by line, a snapshot's file to the current one. */
function compareLines(before: string, after: string): Line[] {
  const lines: Line[] = []
  let a = 1
  let b = 1
  for (const part of diffLines(before, after)) {
    const texts = part.value.replace(/\n$/, "").split("\n")
    for (const text of texts) {
      if (part.added) lines.push({ kind: "added", text, before: null, after: b++ })
      else if (part.removed) lines.push({ kind: "removed", text, before: a++, after: null })
      else lines.push({ kind: "same", text, before: a++, after: b++ })
    }
  }
  return lines
}

/** Changed lines with three lines of context around them; the rest folds into "… n righe uguali". */
function withContext(lines: Line[]) {
  const keep = new Set<number>()
  lines.forEach((line, index) => {
    if (line.kind === "same") return
    for (let near = Math.max(0, index - 3); near <= Math.min(lines.length - 1, index + 3); near++) keep.add(near)
  })
  const result: ({ fold: number } | Line)[] = []
  let folded = 0
  lines.forEach((line, index) => {
    if (keep.has(index)) {
      if (folded) result.push({ fold: folded })
      folded = 0
      result.push(line)
    } else folded++
  })
  if (folded && keep.size) result.push({ fold: folded })
  return result
}

/**
 * A snapshot against the current text, file by file, in place of the editor; "Ripristina" puts it back for everyone
 * (the backend snapshots the current text first).
 */
export function SnapshotCompare({
  snapshot,
  currentFiles,
  canRestore,
  onClose,
  onRestored,
}: {
  snapshot: Snapshot
  currentFiles: () => Files
  canRestore: boolean
  onClose: () => void
  onRestored: () => void
}) {
  const load = useServerFn(getSnapshot)
  const restore = useServerFn(restoreSnapshot)
  const [files, setFiles] = useState<Files | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let current = true
    setFiles(null)
    setFailed(false)
    load({ data: { snapshotId: snapshot.id } }).then(
      (result) => {
        if (current) setFiles(result.files)
      },
      (error) => {
        console.error(error)
        if (current) setFailed(true)
      }
    )
    return () => {
      current = false
    }
  }, [load, snapshot.id])

  const changes = useMemo(() => {
    if (!files) return null
    const now = currentFiles()
    const paths = [...new Set([...Object.keys(files), ...Object.keys(now)])].sort()
    return paths.flatMap((path) => {
      const before = files[path] ?? ""
      const after = now[path] ?? ""
      if (before === after) return []
      const lines = compareLines(before, after)
      return [
        {
          path,
          status: !(path in files) ? "aggiunto dopo" : !(path in now) ? "eliminato dopo" : null,
          added: lines.filter((line) => line.kind === "added").length,
          removed: lines.filter((line) => line.kind === "removed").length,
          rows: withContext(lines),
        },
      ]
    })
  }, [files, currentFiles])

  return (
    <section
      aria-label="Confronto con la versione"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--pn-surface)"
    >
      <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-(--pn-line) py-1.5 pr-1 pl-3">
        <History aria-hidden className="size-4 text-(--pn-fg-muted)" />
        <h2 className="min-w-0 flex-1 truncate text-[14px]">
          <span className="font-semibold">{snapshotTitle(snapshot)}</span>
          <span className="text-(--pn-fg-muted)"> · {formatDayTime(snapshot.createdAt)} → testo attuale</span>
        </h2>
        {canRestore ? (
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            <RotateCcw aria-hidden data-icon="inline-start" />
            Ripristina
          </Button>
        ) : null}
        <IconButton label="Chiudi il confronto" icon={X} onClick={onClose} />
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {failed ? (
          <div className="p-3">
            <InlineAlert>Non è stato possibile aprire questa versione.</InlineAlert>
          </div>
        ) : changes === null ? (
          <div className="grid place-items-center p-8">
            <Spinner />
          </div>
        ) : changes.length === 0 ? (
          <p className="p-6 text-center text-[14px] text-(--pn-fg-muted)">
            Il testo attuale è uguale a questa versione.
          </p>
        ) : (
          changes.map((file) => (
            <div key={file.path} className="border-b border-(--pn-line)">
              <h3 className="sticky top-0 flex items-center gap-2 border-b border-(--pn-line) bg-(--pn-surface) px-3 py-2 font-mono text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">{file.path}</span>
                {file.status ? <span className="font-sans text-(--pn-fg-muted)">{file.status}</span> : null}
                <span className="text-(--pn-success-fg) tabular-nums">+{file.added}</span>
                <span className="text-(--pn-danger-fg) tabular-nums">−{file.removed}</span>
              </h3>
              <table className="w-full border-collapse font-mono text-[12.5px] leading-5">
                <tbody>
                  {file.rows.map((row, index) =>
                    "fold" in row ? (
                      <tr key={index}>
                        <td
                          colSpan={3}
                          className="bg-(--pn-sunken) px-3 py-1 font-sans text-[12px] text-(--pn-fg-muted)"
                        >
                          … {row.fold} {row.fold === 1 ? "riga uguale" : "righe uguali"}
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={index}
                        className={cn(
                          row.kind === "added" && "bg-(--pn-success-bg)",
                          row.kind === "removed" && "bg-(--pn-danger-bg)"
                        )}
                      >
                        <td className="w-10 px-2 text-right text-(--pn-fg-subtle) tabular-nums select-none">
                          {row.before ?? ""}
                        </td>
                        <td className="w-10 px-2 text-right text-(--pn-fg-subtle) tabular-nums select-none">
                          {row.after ?? ""}
                        </td>
                        <td className="px-2 break-words whitespace-pre-wrap">
                          <span aria-hidden className="mr-2 text-(--pn-fg-muted) select-none">
                            {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : " "}
                          </span>
                          <span className="sr-only">
                            {row.kind === "added" ? "Aggiunta: " : row.kind === "removed" ? "Tolta: " : ""}
                          </span>
                          {row.text}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="primary"
        icon={RotateCcw}
        title="Ripristinare questa versione?"
        description="Il testo torna com'era per tutti. Il testo attuale resta nella cronologia, per riprenderlo se serve."
        cancelLabel="Annulla"
        confirmLabel="Ripristina"
        onConfirm={async () => {
          try {
            await restore({ data: { snapshotId: snapshot.id } })
          } catch (caught) {
            console.error(caught)
            throw new Error(failureMessage(caught, "Non è stato possibile ripristinare la versione."), {
              cause: caught,
            })
          }
          appToast.success("Versione ripristinata.")
          onRestored()
        }}
      />
    </section>
  )
}
