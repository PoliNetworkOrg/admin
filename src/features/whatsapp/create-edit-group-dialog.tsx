import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Pencil, Plus } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createWhatsappGroup, editWhatsappGroup } from "@/features/whatsapp/groups.functions"
import type { WaGroup } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"

const LINK_PATTERN = /^https:\/\/chat\.whatsapp\.com\//

export function CreateEditGroupDialog({ group }: { group?: WaGroup }) {
  const router = useRouter()
  const createGroupFn = useServerFn(createWhatsappGroup)
  const editGroupFn = useServerFn(editWhatsappGroup)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(group?.title ?? "")
  const [tag, setTag] = useState(group?.tag ?? "")
  const [link, setLink] = useState(group?.link ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const titleId = useId()
  const tagId = useId()
  const linkId = useId()

  const canSave = Boolean(title.trim()) && LINK_PATTERN.test(link.trim())

  function reset() {
    setTitle(group?.title ?? "")
    setTag(group?.tag ?? "")
    setLink(group?.link ?? "")
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || pending) return
    setPending(true)
    setError("")
    try {
      const values = { title: title.trim(), tag: tag.trim() || undefined, link: link.trim() }
      if (group) {
        await editGroupFn({ data: { id: group.id, ...values } })
        toast.success(`${values.title} updated.`)
      } else {
        await createGroupFn({ data: values })
        toast.success(`${values.title} added.`)
      }
      setOpen(false)
      if (!group) reset()
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group could not be saved. Check the details and try again."))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger render={group ? <Button variant="outline" size="icon-sm" /> : <Button />}>
        {group ? (
          <>
            <Pencil />
            <span className="sr-only">Edit {group.title}</span>
          </>
        ) : (
          <>
            <Plus data-icon="inline-start" /> Add group
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? "Edit WhatsApp group" : "Add WhatsApp group"}</DialogTitle>
          <DialogDescription>
            {group
              ? "Update this group's details."
              : "Register a WhatsApp group. There's no bot managing WhatsApp groups yet, so this is just a manual record."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={titleId}>Title</FieldLabel>
            <Input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Gruppo Informatica 1"
              maxLength={200}
              required
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={tagId}>Tag (optional)</FieldLabel>
            <Input id={tagId} value={tag} onChange={(event) => setTag(event.target.value)} placeholder="informatica" />
          </Field>
          <Field>
            <FieldLabel htmlFor={linkId}>Invite link</FieldLabel>
            <Input
              id={linkId}
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://chat.whatsapp.com/…"
              type="url"
              required
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSave}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {group ? "Save changes" : "Add group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
