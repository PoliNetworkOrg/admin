import { Eye, EyeOff } from "lucide-react"

import { IconButton } from "./icon-button"

type VisibilityToggleProps = {
  visible: boolean
  pending: boolean
  onToggle: () => void
  disabled?: boolean
  /** The record's name, added to the accessible label ("Analisi 1 visible on the site"). */
  name?: string
  className?: string
}

/** `aria-pressed` reflects "visible on the site"; hidden shows `EyeOff` in the warning color. */
export function VisibilityToggle({ visible, pending, onToggle, disabled, name, className }: VisibilityToggleProps) {
  return (
    <IconButton
      label="Visible on the site"
      ariaLabel={name ? `${name} visible on the site` : undefined}
      icon={visible ? Eye : EyeOff}
      tone={visible ? "info" : "warning"}
      appearance="tinted"
      aria-pressed={visible}
      pending={pending}
      disabled={disabled}
      onClick={onToggle}
      className={className}
    />
  )
}
