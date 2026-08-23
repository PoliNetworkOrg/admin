import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { leaveTelegramGroup } from "@/features/telegram/groups.functions"
import { errorMessage } from "@/lib/errors"

export function LeaveGroupDialog({ chatId, title }: { chatId: number; title: string }) {
  const router = useRouter()
  const leaveTelegramGroupFn = useServerFn(leaveTelegramGroup)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function leaveGroup() {
    setPending(true)
    try {
      const result = await leaveTelegramGroupFn({ data: { chatId } })
      if (result.error === "BOT_ERROR") throw new Error("The Telegram bot could not leave this group.")
      if (result.error && result.error !== "NOT_FOUND") {
        throw new Error(
          result.error === "UNAUTHORIZED"
            ? "You do not have permission to leave this group."
            : "The group could not be left."
        )
      }
      if (result.error === "NOT_FOUND") {
        console.error(result.error)
        toast.warning("The bot left the group, but its database record was already missing.")
      } else {
        toast.success(`Left ${title}.`)
      }
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.error(errorMessage(error, "The group could not be left."))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 data-icon="inline-start" /> Leave
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            The bot will leave this Telegram group and the backend will delete its group record. This action affects one
            group and cannot be undone here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void leaveGroup()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />} Confirm leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
