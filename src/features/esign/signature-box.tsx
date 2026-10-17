import { Check, X } from "lucide-react"
import { type KeyboardEvent, type PointerEvent, useRef } from "react"

import { cn } from "@/lib/utils"

export type BoxPlacement = { page: number; x: number; y: number; width: number; height: number }

type SignatureBoxProps = {
  placement: BoxPlacement
  /** The signer's name, and their role under it. */
  label: string
  role?: string | null
  /** 1-based order shown in the corner when several signers share a document. */
  number?: number
  state: "active" | "pending" | "signed"
  /** Draggable, resizable and movable with the arrow keys. */
  editable?: boolean
  onChange?: (placement: BoxPlacement) => void
  onRemove?: () => void
}

const MIN = 0.04

function arrowDelta(key: string, step: number): [number, number] | null {
  switch (key) {
    case "ArrowLeft":
      return [-step, 0]
    case "ArrowRight":
      return [step, 0]
    case "ArrowUp":
      return [0, -step]
    case "ArrowDown":
      return [0, step]
    default:
      return null
  }
}
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * A signature's place on a page, drawn over the PDF in percentages so it follows the zoom. Editable boxes drag from
 * anywhere, resize from the corner handle, and move with the arrow keys (Shift for larger steps, Alt to resize).
 */
export function SignatureBox({
  placement,
  label,
  role,
  number,
  state,
  editable,
  onChange,
  onRemove,
}: SignatureBoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; origin: BoxPlacement } | null>(null)

  function start(event: PointerEvent<HTMLElement>, mode: "move" | "resize") {
    if (!editable || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { mode, startX: event.clientX, startY: event.clientY, origin: placement }
    ref.current?.focus({ preventScroll: true })
  }

  function move(event: PointerEvent<HTMLElement>) {
    const current = drag.current
    const page = ref.current?.parentElement?.getBoundingClientRect()
    if (!current || !page || !onChange) return
    const dx = (event.clientX - current.startX) / page.width
    const dy = (event.clientY - current.startY) / page.height
    const o = current.origin
    if (current.mode === "move") {
      onChange({ ...o, x: clamp(o.x + dx, 0, 1 - o.width), y: clamp(o.y + dy, 0, 1 - o.height) })
    } else {
      onChange({ ...o, width: clamp(o.width + dx, MIN, 1 - o.x), height: clamp(o.height + dy, MIN, 1 - o.y) })
    }
  }

  function end() {
    drag.current = null
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!editable || !onChange) return
    const stepSize = event.shiftKey ? 0.05 : 0.005
    const delta = arrowDelta(event.key, stepSize)
    if (!delta) {
      if ((event.key === "Delete" || event.key === "Backspace") && onRemove) {
        event.preventDefault()
        onRemove()
      }
      return
    }
    event.preventDefault()
    const p = placement
    if (event.altKey)
      onChange({
        ...p,
        width: clamp(p.width + delta[0], MIN, 1 - p.x),
        height: clamp(p.height + delta[1], MIN, 1 - p.y),
      })
    else onChange({ ...p, x: clamp(p.x + delta[0], 0, 1 - p.width), y: clamp(p.y + delta[1], 0, 1 - p.height) })
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a draggable region, not a group of form controls
    <div
      ref={ref}
      role="group"
      tabIndex={editable ? 0 : -1}
      aria-label={
        editable
          ? `Signature of ${label}, page ${placement.page + 1}. Arrow keys move it, Alt with arrow keys resizes it.`
          : `Signature of ${label}, page ${placement.page + 1}`
      }
      onKeyDown={onKeyDown}
      onPointerDown={(event) => start(event, "move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      data-focus-ring="none"
      className={cn(
        "group/box absolute flex touch-none flex-col justify-center overflow-hidden rounded-(--pn-r-2) border-2 px-2 text-left select-none",
        "outline-none focus-visible:ring-3 focus-visible:ring-(--pn-focus)/40",
        state === "active" &&
          "border-(--pn-accent) bg-[color-mix(in_oklab,var(--pn-accent-soft)_82%,transparent)] text-(--pn-accent)",
        state === "pending" &&
          "border-dashed border-(--pn-fg-muted) bg-[color-mix(in_oklab,white_70%,transparent)] text-(--pn-fg-muted)",
        state === "signed" && "border-(--pn-success-solid) bg-transparent text-(--pn-success-fg)",
        editable && "cursor-move"
      )}
      style={{
        left: `${placement.x * 100}%`,
        top: `${placement.y * 100}%`,
        width: `${placement.width * 100}%`,
        height: `${placement.height * 100}%`,
      }}
    >
      {state !== "signed" && (
        <>
          <span className="flex min-w-0 items-center gap-1.5 text-[clamp(9px,1.6cqw,13px)] leading-tight font-semibold">
            {number !== undefined && (
              <span className="inline-grid size-[1.4em] shrink-0 place-items-center rounded-full bg-current text-[0.85em] tabular-nums">
                <span className="text-white">{number}</span>
              </span>
            )}
            <span className="truncate">{label}</span>
          </span>
          {role && <span className="truncate text-[clamp(8px,1.4cqw,12px)] leading-tight opacity-80">{role}</span>}
        </>
      )}
      {state === "signed" && (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-(--pn-success-solid) text-white">
          <Check aria-hidden className="size-3.5" />
        </span>
      )}
      {editable && onRemove && (
        <button
          type="button"
          aria-label={`Remove the signature of ${label}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRemove}
          className="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full text-(--pn-fg-muted) opacity-0 transition-opacity duration-120 group-hover/box:opacity-100 group-focus-within/box:opacity-100 hover:bg-(--pn-hover) hover:text-(--pn-accent)"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
      {editable && (
        <span
          aria-hidden
          onPointerDown={(event) => start(event, "resize")}
          onPointerMove={move}
          onPointerUp={end}
          className="absolute right-0 bottom-0 size-4 cursor-nwse-resize"
        >
          <span className="absolute right-0.5 bottom-0.5 size-2 rounded-[2px] border-r-2 border-b-2 border-current" />
        </span>
      )}
    </div>
  )
}
