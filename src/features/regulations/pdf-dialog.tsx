import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Download, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  buttonMotion,
  dialogMotion,
  Hint,
  IconButton,
  InlineAlert,
  scrimClasses,
  Spinner,
} from "@/components/primitives"
import { dialogDescriptionText, dialogPanel, dialogTitleText } from "@/components/primitives/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { PdfViewer } from "@/features/esign/pdf-viewer"
import { cn } from "@/lib/utils"

import { failureMessage } from "./regulations-hooks"

/** A PDF as the server functions return it (the browser never reaches the backend). */
export type PdfFile = { fileName: string; contentType: string; base64: string }
/** A PDF already in the browser, e.g. the editor's compiled preview. */
export type PdfBytes = { fileName: string; bytes: Uint8Array }

/** What a `PdfDialog` shows: its header, and how to fetch the file, called each time the dialog opens. */
export type PdfDocument = {
  title: string
  /** One line under the title: what this PDF is ("In vigore · Approvato dal Consiglio Direttivo…"). */
  description?: string
  load: () => Promise<PdfFile | PdfBytes>
  /** Shown when `load` fails and the backend gave no Italian reason. */
  failure?: string
}

function toBytes(file: PdfFile | PdfBytes): PdfBytes {
  if ("bytes" in file) return file
  return { fileName: file.fileName, bytes: Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0)) }
}

/** Saves a PDF, from a server function or already in the browser, under its file name. */
export function downloadPdf(file: PdfFile | PdfBytes) {
  const { fileName, bytes } = toBytes(file)
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/pdf" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Opens a `PdfDialog`: `show(document)` from a click, `props` spread on the dialog. The document stays after closing,
 * so the dialog keeps its content through the exit animation.
 */
export function usePdfDialog() {
  const [state, setState] = useState<{ open: boolean; document: PdfDocument | null }>({ open: false, document: null })
  const show = useCallback((document: PdfDocument) => setState({ open: true, document }), [])
  const onOpenChange = useCallback((open: boolean) => setState((current) => ({ ...current, open })), [])
  return { show, props: { open: state.open, onOpenChange, document: state.document } }
}

/**
 * A PDF read inside the dashboard: a dialog as tall as the window (a full-height sheet on phones) holding the shared
 * pdf.js viewer, so every browser shows the document the same way, with the page counter, zoom and Download in its
 * toolbar. Esc or the close button closes it; the pages take the focus, so the keyboard scrolls them at once.
 */
export function PdfDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: PdfDocument | null
}) {
  const popupRef = useRef<HTMLDivElement>(null)
  // Fetched once per document (each `show` passes a new one) and again on Riprova; kept while the dialog closes.
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ document: PdfDocument; file: PdfBytes | null; error: unknown } | null>(null)
  useEffect(() => {
    if (!document) return
    let current = true
    setResult({ document, file: null, error: null })
    document.load().then(
      (file) => {
        if (current) setResult({ document, file: toBytes(file), error: null })
      },
      (caught) => {
        console.error(caught)
        if (current) setResult({ document, file: null, error: caught ?? new Error("load failed") })
      }
    )
    return () => {
      current = false
    }
  }, [document, attempt])
  const settled = result?.document === document ? result : null
  const file = settled?.file ?? null
  const error = settled?.error ?? null

  // Opened while loading, the focus rests on the dialog: hand it to the pages once they arrive, so the keyboard
  // scrolls them without a Tab first.
  useEffect(() => {
    const popup = popupRef.current
    if (!file || !popup || window.document.activeElement !== popup) return
    popup.querySelector<HTMLElement>("[data-pdf-scroll]")?.focus({ preventScroll: true })
  }, [file])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={scrimClasses} />
        <DialogPrimitive.Popup
          ref={popupRef}
          initialFocus={() => popupRef.current?.querySelector<HTMLElement>("[data-pdf-scroll]") ?? popupRef.current}
          className={cn(
            dialogPanel,
            dialogMotion,
            "h-[calc(100dvh-32px)] max-w-[1080px] max-shell:h-[calc(100dvh-24px)]"
          )}
        >
          <header className="flex shrink-0 items-start gap-3 px-5.5 pt-4 pb-3 max-shell:px-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1.5">
              <DialogTitle className={cn(dialogTitleText, "line-clamp-2 break-words")}>
                {document?.title ?? ""}
              </DialogTitle>
              {document?.description ? (
                <DialogDescription className={dialogDescriptionText}>
                  <Hint label={document.description} overflowOnly>
                    <span className="block truncate">{document.description}</span>
                  </Hint>
                </DialogDescription>
              ) : null}
            </div>
            <IconButton label="Chiudi" icon={X} onClick={() => onOpenChange(false)} className="-mr-2 shrink-0" />
          </header>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 max-shell:px-3 max-shell:pb-3">
            {error ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-sunken) p-6">
                <InlineAlert>
                  {failureMessage(error, document?.failure ?? "Non è stato possibile aprire il PDF.")}
                </InlineAlert>
                <Button variant="outline" size="sm" className={buttonMotion} onClick={() => setAttempt((n) => n + 1)}>
                  Riprova
                </Button>
              </div>
            ) : file ? (
              <PdfViewer
                key={file.fileName}
                data={file.bytes}
                fill={false}
                locale="it"
                toolbarStart={
                  <IconButton
                    label="Scarica PDF"
                    ariaLabel={`Scarica ${file.fileName}`}
                    icon={Download}
                    onClick={() => downloadPdf(file)}
                  />
                }
              />
            ) : (
              <div
                role="status"
                className="grid min-h-0 flex-1 place-items-center rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-sunken) text-[13px] text-(--pn-fg-muted)"
              >
                <span className="flex items-center gap-2">
                  <Spinner className="size-4" />
                  Caricamento del PDF…
                </span>
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
