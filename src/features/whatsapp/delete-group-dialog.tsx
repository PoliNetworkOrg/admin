import { useServerFn } from "@tanstack/react-start"

import { ConfirmDialog } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { deleteWhatsappGroup } from "@/features/whatsapp/groups.functions"
import { errorMessage } from "@/lib/errors"

type DeleteWhatsappGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: { id: number; title: string }
  /** Reloads the route data once the group is gone. */
  onDeleted: () => Promise<void>
}

/** "Delete {title}?" (§7.7, §8.2). */
export function DeleteWhatsappGroupDialog({ open, onOpenChange, group, onDeleted }: DeleteWhatsappGroupDialogProps) {
  const deleteGroupFn = useServerFn(deleteWhatsappGroup)

  async function remove() {
    try {
      await deleteGroupFn({ data: { id: group.id } })
    } catch (cause) {
      console.error(cause)
      throw new Error(errorMessage(cause, "The group could not be deleted. Check your permissions and try again."), {
        cause,
      })
    }
    appToast.success(`${group.title} deleted.`)
    await onDeleted()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${group.title}?`}
      description="The group record is removed. This cannot be undone."
      confirmLabel="Delete group"
      onConfirm={remove}
    />
  )
}
