import { Copy, ExternalLink, Link2Off } from "lucide-react"

import { appToast } from "@/components/shell/toast"

import { IconButton } from "./icon-button"

type InviteLinkActionsProps = {
  link: string | null
  /** The group's name, added to the accessible labels ("Open invite link for Analisi 1"). */
  name?: string
}

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link)
    appToast.success("Invite link copied.")
  } catch (error) {
    console.error(error)
    appToast.error("The invite link could not be copied.")
  }
}

/**
 * Copy and open the group's invite link: two ghost buttons, flush, with 8px before the actions that follow. Without a
 * link, a disabled "Not shared" button (dimmed amber icon) takes Open's place and Copy's slot stays empty, so columns stay aligned.
 */
export function InviteLinkActions({ link, name }: InviteLinkActionsProps) {
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
            icon={Copy}
            onClick={() => void copyLink(link)}
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
