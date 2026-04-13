"use client"

import { OctagonX, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Spinner } from "@/components/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { leaveChat } from "@/server/actions/groups"

export function LeaveChat({ chatId }: { chatId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    try {
      const { error } = await leaveChat(chatId)

      if (error === "UNAUTHORIZED") toast.error("You don't have enough permission")
      else if (error === "BOT_ERROR") {
        toast.error("Cannot leave the group")
      } else if (error === "NOT_FOUND") {
        toast.warning("Group left BUT not found in db")
      } else {
        toast.success("Group left and deleted")
        router.refresh()
      }
    } catch (err) {
      toast.error("There was an error")
      console.error(err)
    } finally {
      setPending(false)
      handleOpenChange(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive">
            <Trash2 />
            Leave
          </Button>
        }
      ></AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <OctagonX />
          </AlertDialogMedia>
          <AlertDialogTitle>Leave chat</AlertDialogTitle>
          <AlertDialogDescription>
            This will make the bot leave the chat and the backend delete the group from the table.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={submit} variant="destructive">
            {pending ? <Spinner /> : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
