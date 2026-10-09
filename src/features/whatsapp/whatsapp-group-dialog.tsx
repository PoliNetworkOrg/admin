import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"

import { checkboxControl, fieldControl, fieldHintId, FormDialog, FormField } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { createWhatsappGroup, editWhatsappGroup } from "@/features/whatsapp/groups.functions"
import { isValidWhatsappInviteLink, WHATSAPP_INVITE_LINK_MAX } from "@/features/whatsapp/whatsapp.validation"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

const TITLE_MAX = 200
const LINK_HINT = "Must start with https://chat.whatsapp.com/"
const LINK_ERROR = "Enter a valid WhatsApp group invite link."
const TITLE_ERROR = "Enter a title for the group."

type WhatsappGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this group; omit to add a new one. */
  group?: { id: number; title: string; link: string | null }
  /** Reloads the route data after a save. */
  onSaved: () => Promise<void>
}

type Errors = { title: string | null; link: string | null }

function validate(title: string, link: string): Errors {
  return {
    title: title.trim() ? null : TITLE_ERROR,
    link: isValidWhatsappInviteLink(link.trim()) ? null : LINK_ERROR,
  }
}

/** "Add WhatsApp group" / "Edit WhatsApp group". */
export function WhatsappGroupDialog({ open, onOpenChange, group, onSaved }: WhatsappGroupDialogProps) {
  const createGroupFn = useServerFn(createWhatsappGroup)
  const editGroupFn = useServerFn(editWhatsappGroup)
  const id = useId()
  const titleId = `${id}-title`
  const linkId = `${id}-link`
  const initialTitle = group?.title ?? ""
  const initialLink = group?.link ?? ""

  const [title, setTitle] = useState(initialTitle)
  const [link, setLink] = useState(initialLink)
  const [hide, setHide] = useState(false)
  const [errors, setErrors] = useState<Errors>({ title: null, link: null })
  const [openedFor, setOpenedFor] = useState<string | null>(null)

  // Reset the fields every time the dialog opens, for a new group or another record.
  const session = open ? (group ? `edit:${group.id}` : "create") : null
  if (session !== openedFor) {
    setOpenedFor(session)
    if (session !== null) {
      setTitle(initialTitle)
      setLink(initialLink)
      setHide(false)
      setErrors({ title: null, link: null })
    }
  }

  const dirty = title !== initialTitle || link !== initialLink || hide

  // Fields that have errored re-validate on blur; nothing validates while typing.
  function revalidate(field: keyof Errors) {
    if (errors[field] === null) return
    setErrors((current) => ({ ...current, [field]: validate(title, link)[field] }))
  }

  async function submit() {
    const next = validate(title, link)
    setErrors(next)
    if (next.title || next.link) {
      document.getElementById(next.title ? titleId : linkId)?.focus()
      return
    }

    const values = { title: title.trim(), link: link.trim() }
    try {
      if (group) await editGroupFn({ data: { id: group.id, ...values } })
      else await createGroupFn({ data: { ...values, hide } })
    } catch (cause) {
      console.error(cause)
      throw new Error(errorMessage(cause, "The group could not be saved. Check the details and try again."), {
        cause,
      })
    }
    await onSaved()
    appToast.success(group ? `${values.title} updated.` : `${values.title} added.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={group ? "Edit WhatsApp group" : "Add WhatsApp group"}
      description={
        group
          ? "Update this group's details."
          : "Register a WhatsApp group. There's no bot managing WhatsApp groups yet, so this is just a manual record."
      }
      noun="group"
      dirty={dirty}
      canSubmit={!group || dirty}
      submitLabel={group ? "Save changes" : "Add group"}
      onSubmit={submit}
    >
      <FormField
        label="Title"
        htmlFor={titleId}
        error={errors.title}
        counter={{ length: title.length, max: TITLE_MAX }}
      >
        <Input
          id={titleId}
          value={title}
          maxLength={TITLE_MAX}
          placeholder="Gruppo Informatica 1"
          autoComplete="off"
          aria-invalid={errors.title !== null || undefined}
          aria-describedby={errors.title ? fieldHintId(titleId) : undefined}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => revalidate("title")}
          className={cn("h-9", fieldControl)}
        />
      </FormField>
      <FormField label="Invite link" htmlFor={linkId} hint={LINK_HINT} error={errors.link}>
        <Input
          id={linkId}
          type="url"
          inputMode="url"
          value={link}
          maxLength={WHATSAPP_INVITE_LINK_MAX}
          placeholder="https://chat.whatsapp.com/…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={errors.link !== null || undefined}
          aria-describedby={fieldHintId(linkId)}
          onChange={(event) => setLink(event.target.value)}
          onBlur={() => revalidate("link")}
          className={cn("h-9", fieldControl)}
        />
      </FormField>
      {!group && (
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox checked={hide} onCheckedChange={setHide} className={checkboxControl} />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] leading-5 font-medium text-(--pn-fg)">Hide until published</span>
            <span className="text-xs text-(--pn-fg-muted)">
              Keeps this group off the site until you make it visible later.
            </span>
          </span>
        </label>
      )}
    </FormDialog>
  )
}
