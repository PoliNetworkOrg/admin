import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Plus } from "lucide-react"
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
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel } from "@/features/group-labels/group-labels.functions"
import { createTelegramGroup, tagTelegramGroup } from "@/features/telegram/groups.functions"
import { errorMessage } from "@/lib/errors"

const LINK_PATTERN = /^https:\/\/t\.me\//

export function CreateGroupDialog({
  autoAssignLabel,
  autoAssignLabelExists = false,
}: {
  /** When set (e.g. from a "groups by label" branch page), the new group is tagged with this label after creation. */
  autoAssignLabel?: string
  /** Whether `autoAssignLabel` already exists as a real label; if not, it's created first. */
  autoAssignLabelExists?: boolean
} = {}) {
  const router = useRouter()
  const createGroupFn = useServerFn(createTelegramGroup)
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const tagGroupFn = useServerFn(tagTelegramGroup)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [telegramId, setTelegramId] = useState("")
  const [tag, setTag] = useState("")
  const [link, setLink] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const titleId = useId()
  const telegramIdFieldId = useId()
  const tagId = useId()
  const linkId = useId()

  const parsedTelegramId = Number(telegramId)
  const canSave =
    Boolean(title.trim()) &&
    telegramId.trim() !== "" &&
    Number.isInteger(parsedTelegramId) &&
    LINK_PATTERN.test(link.trim())

  function reset() {
    setTitle("")
    setTelegramId("")
    setTag("")
    setLink("")
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || pending) return
    setPending(true)
    setError("")
    try {
      const { telegramId } = await createGroupFn({
        data: {
          title: title.trim(),
          telegramId: parsedTelegramId,
          tag: tag.trim() || undefined,
          link: link.trim(),
        },
      })

      if (autoAssignLabel) {
        try {
          if (!autoAssignLabelExists) {
            await createGroupLabelFn({
              data: { label: autoAssignLabel, color: DEFAULT_GROUP_LABEL_COLOR, description: "" },
            })
          }
          await tagGroupFn({ data: { groupId: telegramId, label: autoAssignLabel } })
          toast.success(`${title.trim()} added and labeled "${autoAssignLabel}".`)
        } catch (tagCause) {
          console.error(tagCause)
          toast.warning(`${title.trim()} was added, but could not be labeled "${autoAssignLabel}". Assign it manually.`)
        }
      } else {
        toast.success(`${title.trim()} added.`)
      }

      setOpen(false)
      reset()
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group could not be created. Check the details and try again."))
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
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" /> Add group
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Telegram group</DialogTitle>
          <DialogDescription>
            Register a group the bot already administers.
            {autoAssignLabel && (
              <>
                {" "}
                It will be labeled <strong className="text-foreground">{autoAssignLabel}</strong>.
              </>
            )}{" "}
            Reusing an invite link already assigned to another group removes that other group.
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
            <FieldLabel htmlFor={telegramIdFieldId}>Telegram ID</FieldLabel>
            <Input
              id={telegramIdFieldId}
              value={telegramId}
              onChange={(event) => setTelegramId(event.target.value)}
              placeholder="-1001234567890"
              inputMode="numeric"
              required
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
              placeholder="https://t.me/joinchat/…"
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
              Add group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
