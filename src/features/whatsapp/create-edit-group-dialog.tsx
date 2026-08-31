import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Pencil, Plus } from "lucide-react"
import { useState } from "react"
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
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel, tagGroup } from "@/features/group-labels/group-labels.functions"
import { createWhatsappGroup, editWhatsappGroup } from "@/features/whatsapp/groups.functions"
import { WHATSAPP_LINK_PATTERN, WhatsappGroupFields } from "@/features/whatsapp/whatsapp-group-fields"
import type { WaGroup } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"

export function CreateEditGroupDialog({
  group,
  autoAssignLabel,
  autoAssignLabelExists = false,
}: {
  group?: WaGroup
  /** When set (e.g. from a "groups by label" branch page), the new group is tagged with this label after creation. */
  autoAssignLabel?: string
  /** Whether `autoAssignLabel` already exists as a real label; if not, it's created first. */
  autoAssignLabelExists?: boolean
}) {
  const router = useRouter()
  const createGroupFn = useServerFn(createWhatsappGroup)
  const editGroupFn = useServerFn(editWhatsappGroup)
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const tagGroupFn = useServerFn(tagGroup)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(group?.title ?? "")
  const [link, setLink] = useState(group?.link ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const canSave = Boolean(title.trim()) && WHATSAPP_LINK_PATTERN.test(link.trim())

  function reset() {
    setTitle(group?.title ?? "")
    setLink(group?.link ?? "")
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || pending) return
    setPending(true)
    setError("")
    try {
      const values = { title: title.trim(), link: link.trim() }
      if (group) {
        await editGroupFn({ data: { id: group.id, ...values } })
        toast.success(`${values.title} updated.`)
      } else {
        const created = await createGroupFn({ data: values })
        if (autoAssignLabel) {
          try {
            if (!autoAssignLabelExists) {
              await createGroupLabelFn({
                data: { label: autoAssignLabel, color: DEFAULT_GROUP_LABEL_COLOR, description: "" },
              })
            }
            await tagGroupFn({ data: { groupId: created.id, label: autoAssignLabel } })
            toast.success(`${values.title} added and labeled "${autoAssignLabel}".`)
          } catch (tagCause) {
            console.error(tagCause)
            toast.warning(
              `${values.title} was added, but could not be labeled "${autoAssignLabel}". Assign it manually.`
            )
          }
        } else {
          toast.success(`${values.title} added.`)
        }
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? "Edit WhatsApp group" : "Add WhatsApp group"}</DialogTitle>
          <DialogDescription>
            {group ? (
              "Update this group's details."
            ) : (
              <>
                Register a WhatsApp group. There's no bot managing WhatsApp groups yet, so this is just a manual record.
                {autoAssignLabel && (
                  <>
                    {" "}
                    It will be labeled <strong className="text-foreground">{autoAssignLabel}</strong>.
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <WhatsappGroupFields title={title} onTitleChange={setTitle} link={link} onLinkChange={setLink} />
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
