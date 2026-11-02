import { CircleAlert, CircleCheck, Download } from "lucide-react"
import { useState } from "react"

import { IconButton, Spinner } from "@/components/primitives"
import { PdfViewer } from "@/features/esign/pdf-viewer"
import { cn } from "@/lib/utils"

import { formatDayTime } from "../regulations-format"
import type { CompileStatus } from "../regulations.contract"

/**
 * The live preview: the compile worker's last good PDF, kept on screen while a newer compile runs or after it fails,
 * with the compile's state above it and the log's tail on demand.
 */
export function PdfPane({
  status,
  pdf,
  onDownload,
  className,
}: {
  status: CompileStatus | null
  pdf: Uint8Array | null
  onDownload: (() => void) | null
  className?: string
}) {
  const [logOpen, setLogOpen] = useState(false)
  const state = status?.state ?? "idle"
  const failed = state === "error"
  const busy = state === "queued" || state === "running"
  return (
    <section aria-label="Anteprima PDF" className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex min-h-9 shrink-0 items-center gap-2 px-1 text-[13px]">
        <span role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2">
          {busy ? (
            <>
              <Spinner className="size-3.5" />
              <span>Compilazione…</span>
            </>
          ) : failed ? (
            <>
              <CircleAlert aria-hidden className="size-4 shrink-0 text-(--pn-danger-fg)" />
              <span className="truncate">Errore di compilazione{pdf ? ": resta l'ultimo PDF riuscito" : ""}</span>
            </>
          ) : state === "ok" && status?.compiledAt ? (
            <>
              <CircleCheck aria-hidden className="size-4 shrink-0 text-(--pn-success-fg)" />
              <span className="truncate text-(--pn-fg-muted) tabular-nums">
                Aggiornato il {formatDayTime(status.compiledAt)}
              </span>
            </>
          ) : (
            <span className="text-(--pn-fg-muted)">In attesa della prima compilazione</span>
          )}
        </span>
        {failed && status?.log ? (
          <button
            type="button"
            className="shrink-0 rounded-(--pn-r-2) px-2 py-1 text-[13px] text-(--pn-accent) transition-[background-color] duration-120 hover:bg-(--pn-hover)"
            aria-expanded={logOpen}
            onClick={() => setLogOpen((open) => !open)}
          >
            {logOpen ? "Nascondi log" : "Mostra log"}
          </button>
        ) : null}
      </div>
      {failed && (status?.errors.length || (logOpen && status?.log)) ? (
        <div className="max-h-48 shrink-0 overflow-auto rounded-(--pn-r-4) bg-(--pn-danger-bg) px-3 py-2 text-[12px]">
          <ul className="flex flex-col gap-1">
            {status?.errors.map((error, index) => (
              <li key={index} className="font-mono break-words">
                {error.file ? `${error.file}${error.line ? `:${error.line}` : ""}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
          {logOpen && status?.log ? (
            <pre className="mt-2 font-mono text-[11.5px] break-words whitespace-pre-wrap text-(--pn-fg-muted)">
              {status.log}
            </pre>
          ) : null}
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        {pdf ? (
          <PdfViewer
            data={pdf}
            fill={false}
            toolbarStart={onDownload ? <IconButton label="Scarica PDF" icon={Download} onClick={onDownload} /> : null}
          />
        ) : (
          <div className="grid h-full min-h-[320px] place-items-center rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-sunken) p-6 text-center text-[13px] text-(--pn-fg-muted)">
            {failed ? (
              "Nessun PDF ancora: correggi gli errori per vedere l'anteprima."
            ) : busy ? (
              <Spinner />
            ) : (
              "Il PDF comparirà qui."
            )}
          </div>
        )}
      </div>
    </section>
  )
}
