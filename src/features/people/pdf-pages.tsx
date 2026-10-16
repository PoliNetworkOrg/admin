import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/primitives"

/** Pages drawn at most: transfer receipts are one or two pages. */
const MAX_PAGES = 4

/**
 * A PDF's pages drawn on canvases with pdf.js, loaded on first use. Browsers' own viewers don't render PDFs inside a
 * page on Android and show only the first page on iOS, so the preview looks the same everywhere this way.
 */
export function PdfPages({ file, label }: { file: Blob; label: string }) {
  const pagesRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const pages = pagesRef.current
    if (!pages) return
    let cancelled = false
    let destroy: (() => Promise<void>) | null = null

    async function draw(target: HTMLDivElement) {
      const [pdfjs, worker] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ])
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
      destroy = () => task.destroy()
      const pdf = await task.promise
      const width = target.clientWidth
      for (let number = 1; number <= Math.min(pdf.numPages, MAX_PAGES); number++) {
        const page = await pdf.getPage(number)
        if (cancelled) return
        const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * devicePixelRatio })
        const canvas = document.createElement("canvas")
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.className = "block w-full bg-white"
        await page.render({ canvas, viewport }).promise
        if (cancelled) return
        target.append(canvas)
      }
      setState("ready")
    }

    setState("loading")
    draw(pages).catch((caught) => {
      console.error(caught)
      if (!cancelled) setState("failed")
    })
    return () => {
      cancelled = true
      pages.replaceChildren()
      destroy?.().catch((caught) => console.error(caught))
    }
  }, [file])

  return (
    <div className="relative max-h-80 min-h-40 overflow-y-auto">
      <div ref={pagesRef} role="img" aria-label={label} className="flex flex-col gap-2" />
      {state === "loading" ? (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-(--pn-fg-muted)"
        >
          <Spinner />
          Loading the file…
        </p>
      ) : null}
      {state === "failed" ? (
        <p className="absolute inset-0 grid place-items-center px-4 text-center text-[13px] text-(--pn-fg-muted)">
          This PDF can't be previewed. Open it to check it.
        </p>
      ) : null}
    </div>
  )
}
