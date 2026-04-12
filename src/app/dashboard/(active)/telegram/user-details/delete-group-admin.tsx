"use client"

import { Trash2, Trash2Icon } from "lucide-react"
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
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth"
import { delGroupAdmin } from "@/server/actions/users"

export function DeleteGroupAdmin({ userId, chatId, onDelete }: { userId: number; chatId: number; onDelete(): void }) {
  const sesh = useSession()

  const removerId = sesh.data?.user.telegramId

  const [open, setOpen] = useState(false)

  async function deleteGroupAdmin() {
    if (!removerId) return toast.error("Invalid session, try to reload the page")

    try {
      await delGroupAdmin(userId, chatId, removerId)
      toast.success("Group Admin deleted!")
      onDelete()
    } catch (err) {
      toast.error("There was an error")
      console.error(err)
    }

    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive">
            <Trash2 />
            Delete
          </Button>
        }
      ></AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove Group Admin</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to remove the group admin?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteGroupAdmin} variant="destructive">
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
