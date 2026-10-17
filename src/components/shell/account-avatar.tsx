import { useState } from "react"

import { initialsOf } from "@/components/primitives"
import { cn } from "@/lib/utils"

/** The signed-in admin as the shell shows them: rail avatar, sheet row, tooltip. */
export type ShellUser = { name: string; email: string; image: string | null }

/** Load results by URL, kept across remounts (rail ↔ sheet, reloads) so a known result shows at once. */
const imageStatus = new Map<string, "loaded" | "failed">()

/** 28px avatar: the profile picture, else initials on the solid accent (also while it loads or if it fails). */
export function AccountAvatar({ user, className }: { user: ShellUser; className?: string }) {
  const src = user.image
  const [status, setStatus] = useState(() => (src === null ? undefined : imageStatus.get(src)))
  const [statusSrc, setStatusSrc] = useState(src)
  if (statusSrc !== src) {
    setStatusSrc(src)
    setStatus(src === null ? undefined : imageStatus.get(src))
  }
  const loaded = status === "loaded"

  function settle(result: "loaded" | "failed") {
    if (src === null) return
    imageStatus.set(src, result)
    setStatus(result)
  }

  // A server-rendered or cached image can settle before hydration attaches `onLoad`/`onError`; `decode()` reports it.
  function checkLoaded(image: HTMLImageElement | null) {
    if (!image?.complete || status !== undefined) return
    image.decode().then(
      () => settle("loaded"),
      () => settle("failed")
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-full text-[11px] font-semibold",
        loaded ? "shadow-(--pn-media-ring)" : "bg-(--pn-accent-solid) text-(--pn-accent-solid-fg)",
        className
      )}
    >
      {!loaded && initialsOf(user.name, user.email)}
      {/* Hidden until decoded, so a slow or broken picture never shows the browser's broken-image icon. */}
      {src !== null && status !== "failed" && (
        <img
          ref={checkLoaded}
          src={src}
          alt=""
          className={cn("absolute inset-0 size-full object-cover", !loaded && "invisible")}
          onLoad={() => settle("loaded")}
          onError={() => settle("failed")}
        />
      )}
    </span>
  )
}
