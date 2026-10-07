import { ExternalLink, Link2Off } from "lucide-react"

import { IconButton } from "./icon-button"

type InviteLinkButtonProps = {
  link: string | null
  /** The group's name, added to the accessible label ("Open invite link for Analisi 1"). */
  name?: string
}

/** Opens the group's invite link in a new tab; disabled with "Not shared" when there is none. */
export function InviteLinkButton({ link, name }: InviteLinkButtonProps) {
  if (link === null) {
    return (
      <IconButton
        label="Not shared"
        ariaLabel={name ? `${name} invite link not shared` : undefined}
        icon={Link2Off}
        appearance="tinted"
        disabled
        focusableWhenDisabled
      />
    )
  }
  return (
    <IconButton
      label="Open invite link"
      ariaLabel={name ? `Open invite link for ${name}` : undefined}
      icon={ExternalLink}
      appearance="tinted"
      nativeButton={false}
      render={<a href={link} target="_blank" rel="noreferrer" />}
    />
  )
}
