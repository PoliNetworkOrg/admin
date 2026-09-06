import { useId } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { WHATSAPP_INVITE_LINK_MAX } from "./whatsapp.validation"

export function WhatsappGroupFields({
  title,
  onTitleChange,
  link,
  onLinkChange,
  hide,
  onHideChange,
}: {
  title: string
  onTitleChange: (value: string) => void
  link: string
  onLinkChange: (value: string) => void
  /** Omit to hide the "Hide until published" option entirely, e.g. when editing an existing group. */
  hide?: boolean
  onHideChange?: (value: boolean) => void
}) {
  const titleId = useId()
  const linkId = useId()
  const hideId = useId()

  return (
    <>
      <Field>
        <FieldLabel htmlFor={titleId}>Title</FieldLabel>
        <Input
          id={titleId}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Gruppo Informatica 1"
          maxLength={200}
          required
          autoFocus
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={linkId}>Invite link</FieldLabel>
        <Input
          id={linkId}
          value={link}
          onChange={(event) => onLinkChange(event.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          type="url"
          maxLength={WHATSAPP_INVITE_LINK_MAX}
          required
        />
      </Field>
      {onHideChange && (
        <Field orientation="horizontal">
          <Checkbox id={hideId} checked={hide ?? false} onCheckedChange={onHideChange} />
          <div>
            <FieldLabel htmlFor={hideId}>Hide until published</FieldLabel>
            <FieldDescription>Keeps this group off the site until you make it visible later.</FieldDescription>
          </div>
        </Field>
      )}
    </>
  )
}
