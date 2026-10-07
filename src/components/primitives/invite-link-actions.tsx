import { CircleCheck, CircleX, Copy, ExternalLink, Link2Off } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { appToast } from "@/components/shell/toast"
import { copyText } from "@/lib/clipboard"
import { cn } from "@/lib/utils"

import { IconButton } from "./icon-button"

type InviteLinkActionsProps = {
  link: string | null
  /** The group's name, added to the accessible labels ("Open invite link for Analisi 1"). */
  name?: string
}

/** How long the copy button shows its result before returning to the copy icon. */
const RESULT_MS = 1500

/**
 * Copy and open the group's invite link: two ghost buttons, flush, with 8px before the actions that follow. Copy shows
 * its result in place (green check, red ✕) for 1.5s. Without a link, a disabled "Not shared" button (dimmed amber
 * icon) takes Open's place and Copy's slot stays empty, so columns stay aligned.
 */
export function InviteLinkActions({ link, name }: InviteLinkActionsProps) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(text: string) {
    let outcome: "copied" | "failed"
    try {
      await copyText(text)
      outcome = "copied"
      appToast.success("Invite link copied.")
    } catch (error) {
      console.error(error)
      outcome = "failed"
      appToast.error("The invite link could not be copied.")
    }
    setResult(outcome)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setResult(null), RESULT_MS)
  }

  return (
    <div className="mr-2 flex shrink-0 items-center">
      {link === null ? (
        <>
          <span aria-hidden className="size-9 shrink-0" />
          <IconButton
            label="Not shared"
            ariaLabel={name ? `${name} invite link not shared` : undefined}
            icon={Link2Off}
            // Amber says "missing", dimmed says it can't be pressed.
            iconClassName="text-(--pn-action-amber) opacity-55"
            disabled
            focusableWhenDisabled
          />
        </>
      ) : (
        <>
          <IconButton
            label="Copy invite link"
            ariaLabel={name ? `Copy invite link for ${name}` : undefined}
            icon={result === "copied" ? CircleCheck : result === "failed" ? CircleX : Copy}
            iconClassName={cn(
              result === "copied" && "text-(--pn-action-green)",
              result === "failed" && "text-(--pn-action-red)"
            )}
            onClick={() => void copy(link)}
          />
          <IconButton
            label="Open invite link"
            ariaLabel={name ? `Open invite link for ${name}` : undefined}
            icon={ExternalLink}
            nativeButton={false}
            render={<a href={link} target="_blank" rel="noreferrer" />}
          />
        </>
      )}
    </div>
  )
}
