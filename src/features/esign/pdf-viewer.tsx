import { Minus, Plus, ScanLine } from "lucide-react"
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"

import { IconButton, InlineAlert } from "@/components/primitives"
import { cn } from "@/lib/utils"

export type PageSize = { width: number; height: number }

type PdfViewerProps = {
  /** The PDF bytes; while null the pages show as blank sheets of the right size. */
  data: Uint8Array | null
  /** Displayed page sizes in points (crop box after rotation), so the layout is right before rendering. */
  pages: PageSize[]
  /** Content over each page, positioned with percentages of the page (`absolute inset-0` layer). */
  overlay?: (page: number) => ReactNode
  /** A click on a page, at fractions of its width and height from the top-left corner. */
  onPageClick?: (page: number, x: number, y: number) => void
  /** Pointer style over pages, e.g. "crosshair" while placing a signature. */
  cursor?: "default" | "crosshair"
  /** A point to bring to the middle of the viewer when it changes: a page and a fraction of its height. */
  focus?: { page: number; y: number } | null
  className?: string
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
const PAGE_GAP = 16

type Pdfjs = typeof import("pdfjs-dist")

let pdfjsPromise: Promise<Pdfjs> | null = null

/** pdf.js loads on demand, in the browser only. */
function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })
  return pdfjsPromise
}

/**
 * The dashboard's own PDF viewer (pdf.js), so every browser shows documents the same way and signatures can be placed
 * on them. Pages render lazily as they near the viewport, at the device pixel ratio; signature appearances are drawn.
 */
export function PdfViewer({ data, pages, overlay, onPageClick, cursor = "default", focus, className }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoom, setZoom] = useState<number | "fit">("fit")
  const [doc, setDoc] = useState<{ pdf: PDFDocumentProxy; pdfjs: Pdfjs } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    if (!data) return
    let cancelled = false
    let task: ReturnType<Pdfjs["getDocument"]> | null = null
    setError(null)
    loadPdfjs()
      .then(async (pdfjs) => {
        // pdf.js takes ownership of the buffer: give it a copy.
        task = pdfjs.getDocument({ data: data.slice() })
        const loaded = await task.promise
        if (!cancelled) setDoc({ pdf: loaded, pdfjs })
      })
      .catch((cause) => {
        console.error(cause)
        if (!cancelled) setError("Couldn't display the PDF.")
      })
    return () => {
      cancelled = true
      setDoc(null)
      void task?.destroy()
    }
  }, [data])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const maxWidth = Math.max(...pages.map((p) => p.width), 1)
  // Fit: the widest page fills the column, up to 1.5× its size in points.
  const fitScale = containerWidth > 0 ? Math.min((containerWidth - 32) / maxWidth, 1.5) : 0
  const scale = zoom === "fit" ? fitScale : zoom

  const focusPage = focus?.page
  const focusY = focus?.y ?? 0.5
  useEffect(() => {
    if (focusPage === undefined || scale <= 0) return
    // Scroll the viewer only: scrollIntoView would also move the page around it.
    const container = scrollRef.current
    const element = container?.querySelector<HTMLElement>(`[data-page="${focusPage}"]`)
    if (!container || !element) return
    const offset = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    const top = offset + element.offsetHeight * focusY - container.clientHeight / 2
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
  }, [focusPage, focusY, scale])

  function step(direction: 1 | -1) {
    const current = zoom === "fit" ? fitScale : zoom
    const next =
      direction > 0 ? ZOOMS.find((z) => z > current + 0.01) : [...ZOOMS].reverse().find((z) => z < current - 0.01)
    if (next) setZoom(next)
  }

  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-(--pn-r-5) border border-(--pn-line)", className)}
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-(--pn-line) bg-(--pn-surface) px-2">
        <span className="px-2 text-[13px] text-(--pn-fg-muted) tabular-nums" aria-live="polite">
          Page {Math.min(currentPage + 1, pages.length)} of {pages.length}
        </span>
        <div className="flex items-center gap-0.5">
          <IconButton label="Zoom out" icon={Minus} onClick={() => step(-1)} disabled={scale <= ZOOMS[0] + 0.01} />
          <span className="w-12 text-center text-[13px] text-(--pn-fg-muted) tabular-nums">
            {scale > 0 ? `${Math.round(scale * 100)}%` : ""}
          </span>
          <IconButton label="Zoom in" icon={Plus} onClick={() => step(1)} disabled={scale >= ZOOMS.at(-1)! - 0.01} />
          <IconButton
            label="Fit width"
            icon={ScanLine}
            onClick={() => setZoom("fit")}
            tone={zoom === "fit" ? "info" : undefined}
          />
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-(--pn-sunken)" data-pdf-scroll>
        {error ? (
          <div className="p-4">
            <InlineAlert>{error}</InlineAlert>
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center p-4" style={{ gap: PAGE_GAP }}>
            {scale > 0 &&
              pages.map((size, index) => (
                <PdfPage
                  // biome-ignore lint/suspicious/noArrayIndexKey: pages are positional
                  key={index}
                  index={index}
                  size={size}
                  scale={scale}
                  doc={doc}
                  root={scrollRef}
                  cursor={cursor}
                  onVisible={setCurrentPage}
                  onClick={onPageClick}
                >
                  {overlay?.(index)}
                </PdfPage>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

type PdfPageProps = {
  index: number
  size: PageSize
  scale: number
  doc: { pdf: PDFDocumentProxy; pdfjs: Pdfjs } | null
  root: React.RefObject<HTMLDivElement | null>
  cursor: "default" | "crosshair"
  onVisible: (index: number) => void
  onClick?: (page: number, x: number, y: number) => void
  children?: ReactNode
}

function PdfPage({ index, size, scale, doc, root, cursor, onVisible, onClick, children }: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [rendered, setRendered] = useState(false)
  const width = Math.round(size.width * scale)
  const height = Math.round(size.height * scale)

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    const nearObserver = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: root.current,
      rootMargin: "800px 0px",
    })
    const visibleObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(index)
      },
      { root: root.current, threshold: 0.5 }
    )
    nearObserver.observe(element)
    visibleObserver.observe(element)
    return () => {
      nearObserver.disconnect()
      visibleObserver.disconnect()
    }
  }, [index, onVisible, root])

  useEffect(() => {
    if (!doc || !near) return
    let task: RenderTask | null = null
    let cancelled = false
    const timer = window.setTimeout(() => {
      doc.pdf
        .getPage(index + 1)
        .then((page: PDFPageProxy) => {
          const canvas = canvasRef.current
          if (cancelled || !canvas) return
          const ratio = window.devicePixelRatio || 1
          const viewport = page.getViewport({ scale: scale * ratio })
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          task = page.render({ canvas, viewport, annotationMode: doc.pdfjs.AnnotationMode.ENABLE })
          return task.promise.then(() => {
            if (!cancelled) setRendered(true)
          })
        })
        .catch((error) => {
          if (!(error instanceof Error && error.name === "RenderingCancelledException")) console.error(error)
        })
    }, 60)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      task?.cancel()
    }
  }, [doc, near, index, scale])

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!onClick || event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    onClick(index, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
  }

  return (
    <div
      ref={wrapperRef}
      data-page={index}
      className="relative shrink-0 bg-white shadow-[0_0_0_1px_var(--pn-line)]"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        aria-label={`Page ${index + 1}`}
        role="img"
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-150",
          rendered ? "opacity-100" : "opacity-0"
        )}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: placing with a pointer; boxes are keyboard-movable */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: as above */}
      <div
        className={cn("@container absolute inset-0", cursor === "crosshair" && "cursor-crosshair")}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  )
}

/** Converts a size in points to fractions of a page, for default signature boxes. */
export function sizeOnPage(page: PageSize, widthPt: number, heightPt: number) {
  return { width: Math.min(widthPt / page.width, 0.9), height: Math.min(heightPt / page.height, 0.5) }
}

export function usePdfBytes(base64: string | null) {
  return useMemo(() => {
    if (!base64) return null
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }, [base64])
}

/** A run of text on a page, in fractions of the displayed page (origin top-left). */
export type TextAnchor = { page: number; text: string; x: number; y: number; width: number; height: number }

/** The text runs of a PDF with their places, to put signature boxes next to labels such as "Il Segretario". */
export async function extractTextAnchors(data: Uint8Array, maxPages = 50): Promise<TextAnchor[]> {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data: data.slice() })
  try {
    const pdf = await task.promise
    const anchors: TextAnchor[] = []
    for (let index = 0; index < Math.min(pdf.numPages, maxPages); index++) {
      const page = await pdf.getPage(index + 1)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue
        const [, , , , x, y] = item.transform
        const corners = [
          viewport.convertToViewportPoint(x, y),
          viewport.convertToViewportPoint(x + item.width, y + item.height),
        ]
        const left = Math.min(corners[0][0], corners[1][0])
        const top = Math.min(corners[0][1], corners[1][1])
        anchors.push({
          page: index,
          text: item.str,
          x: left / viewport.width,
          y: top / viewport.height,
          width: Math.abs(corners[1][0] - corners[0][0]) / viewport.width,
          height: Math.abs(corners[1][1] - corners[0][1]) / viewport.height,
        })
      }
    }
    return anchors
  } finally {
    void task.destroy()
  }
}
