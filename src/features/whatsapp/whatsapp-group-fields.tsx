import { useId } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { WHATSAPP_INVITE_LINK_MAX } from "./whatsapp.validation"

export function WhatsappGroupFields({
  title,
  onTitleChange,
  link,
  onLinkChange,
}: {
  title: string
  onTitleChange: (value: string) => void
  link: string
  onLinkChange: (value: string) => void
}) {
  const titleId = useId()
  const linkId = useId()

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
    </>
  )
}
