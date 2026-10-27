import { ChevronDown, MapPin } from "lucide-react"
import { type ComponentProps, type Ref, useEffect } from "react"

import { buttonMotion, Hint, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/primitives"
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
 * "Move box" in the viewer's toolbar: the next click on any page puts the box there; with several places it first asks
 * which one. Below 420px of toolbar only the icon shows, and the label becomes its tooltip.
 */
export function MoveBoxButton({
  places,
  onPlacing,
  ref,
}: {
  places: Place[]
  onPlacing: (at: number) => void
  ref?: Ref<HTMLButtonElement>
}) {
  if (places.length === 1)
    return (
      <Hint label="Move box" overflowOnly>
        <MoveBoxTrigger ref={ref} onClick={() => onPlacing(0)} />
      </Hint>
    )
  return (
    <Menu>
      {/* The tooltip's trigger outside the menu's, so both get the button's pointer and focus events. */}
      <Hint label="Move box" overflowOnly>
        <MenuTrigger render={<MoveBoxTrigger ref={ref} menu />} />
      </Hint>
      <MenuContent align="start">
        {places.map((p, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: places have no identity but their order
          <MenuItem key={at} className="tabular-nums" onClick={() => onPlacing(at)}>
            {p.kind === "mark" ? "Mark" : "Signature"} · p. {p.page + 1}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}

function MoveBoxTrigger({ menu = false, className, ...props }: ComponentProps<typeof Button> & { menu?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(buttonMotion, "text-(--pn-fg) @max-[420px]:w-9 @max-[420px]:px-0", className)}
      {...props}
    >
      <MapPin aria-hidden className="text-(--pn-fg-muted)" />
      <span className="@max-[420px]:sr-only">Move box</span>
      {menu && <ChevronDown aria-hidden className="text-(--pn-fg-muted) @max-[420px]:hidden" />}
    </Button>
  )
}

/** The viewer's status while one of the signer's places waits for its new spot. */
export function placingStatus(places: Place[], at: number) {
  const place = places[at]
  if (places.length === 1) return "Click the new spot for your signature."
  return `Click the new spot for your ${place.kind} on page ${place.page + 1}.`
}
