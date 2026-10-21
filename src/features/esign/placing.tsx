import { MapPin } from "lucide-react"
import { useEffect } from "react"

import { buttonMotion } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { Place } from "./places"

/** Cancel in the viewer toolbar while the next click on a page places a box. Esc does the same while it is shown. */
export function PlacingCancel({ onCancel }: { onCancel: () => void }) {
  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return
      // An open menu or dialog takes Escape for itself.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      event.preventDefault()
      onCancel()
    }
    window.addEventListener("keydown", cancel)
    return () => window.removeEventListener("keydown", cancel)
  }, [onCancel])

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(buttonMotion, "gap-2")}
      aria-keyshortcuts="Escape"
      onClick={onCancel}
    >
      Cancel
      <kbd
        aria-hidden
        className="rounded-[5px] border border-(--pn-line-strong) bg-(--pn-surface-raised) px-1.5 font-mono text-[11px] leading-4 text-(--pn-fg-muted) pointer-coarse:hidden"
      >
        Esc
      </kbd>
    </Button>
  )
}

/**
 * The signer's "Move to another spot", one button per place when there are several: the next click on any page puts
 * the box there. Choosing the place being moved again cancels.
 */
export function MovePlaceButtons({
  places,
  placing,
  onPlacing,
}: {
  places: Place[]
  placing: number | null
  onPlacing: (at: number | null) => void
}) {
  return places.map((p, at) => {
    const what = p.kind === "mark" ? "mark" : "signature"
    return (
      <Button
        // biome-ignore lint/suspicious/noArrayIndexKey: places have no identity but their order
        key={at}
        variant={placing === at ? "secondary" : "outline"}
        className="h-10 tabular-nums"
        aria-pressed={placing === at}
        aria-label={places.length > 1 ? `Move the ${what} on page ${p.page + 1} to another spot` : undefined}
        onClick={() => onPlacing(placing === at ? null : at)}
      >
        <MapPin aria-hidden />
        {places.length > 1 ? `${p.kind === "mark" ? "Mark" : "Signature"} · p. ${p.page + 1}` : "Move to another spot"}
      </Button>
    )
  })
}

/** The viewer's status while one of the signer's places waits for its new spot. */
export function placingStatus(places: Place[], at: number) {
  const place = places[at]
  if (places.length === 1) return "Click the new spot for your signature."
  return `Click the new spot for your ${place.kind} on page ${place.page + 1}.`
}
