import { useId } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export const WHATSAPP_LINK_PATTERN = /^https:\/\/chat\.whatsapp\.com\//

export function WhatsappGroupFields({
  title,
  onTitleChange,
  tag,
  onTagChange,
  link,
  onLinkChange,
}: {
  title: string
  onTitleChange: (value: string) => void
  tag: string
  onTagChange: (value: string) => void
  link: string
  onLinkChange: (value: string) => void
}) {
  const titleId = useId()
  const tagId = useId()
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
        <FieldLabel htmlFor={tagId}>Tag (optional)</FieldLabel>
        <Input id={tagId} value={tag} onChange={(event) => onTagChange(event.target.value)} placeholder="informatica" />
      </Field>
      <Field>
        <FieldLabel htmlFor={linkId}>Invite link</FieldLabel>
        <Input
          id={linkId}
          value={link}
          onChange={(event) => onLinkChange(event.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          type="url"
          required
        />
      </Field>
    </>
  )
}
