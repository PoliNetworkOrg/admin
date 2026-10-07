import { useServerFn } from "@tanstack/react-start"

import { ConfirmDialog } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { leaveTelegramGroup } from "@/features/telegram/groups.functions"
import { errorMessage } from "@/lib/errors"

type LeaveGroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: { telegramId: number; title: string }
  /** Reloads the route data once the group is gone. */
  onLeft: () => Promise<void>
}

function leaveErrorText(error: string) {
  if (error === "BOT_ERROR") return "The Telegram bot could not leave this group."
  if (error === "UNAUTHORIZED") return "You do not have permission to leave this group."
  return "The group could not be left."
}

/** "Leave {title}?" (§7.6, §8.2): the bot leaves the Telegram group and its record is deleted. */
export function LeaveGroupDialog({ open, onOpenChange, group, onLeft }: LeaveGroupDialogProps) {
  const leaveTelegramGroupFn = useServerFn(leaveTelegramGroup)

  async function leave() {
    let result: Awaited<ReturnType<typeof leaveTelegramGroupFn>>
    try {
      result = await leaveTelegramGroupFn({ data: { chatId: group.telegramId } })
    } catch (cause) {
      console.error(cause)
      throw new Error(errorMessage(cause, "The group could not be left."), { cause })
    }
    if (result.error && result.error !== "NOT_FOUND") throw new Error(leaveErrorText(result.error))

    if (result.error === "NOT_FOUND") {
      appToast.warning("The bot left the group, but its database record was already missing.")
    } else {
      appToast.success(`Left ${group.title}.`)
    }
    await onLeft()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Leave ${group.title}?`}
      description="The bot leaves this Telegram group and its record is deleted. This cannot be undone here."
      confirmLabel="Leave group"
      onConfirm={leave}
    />
  )
}
