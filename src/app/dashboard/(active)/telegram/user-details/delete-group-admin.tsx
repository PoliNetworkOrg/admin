"use client"

import { Trash2, Trash2Icon } from "lucide-react"
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
import { delGroupAdmin } from "@/server/actions/users"

export function DeleteGroupAdmin({ userId, chatId, onDelete }: { userId: number; chatId: number; onDelete(): void }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function deleteGroupAdmin() {
    setPending(true)

    try {
      const { error } = await delGroupAdmin(userId, chatId)

      if (error === "NOT_FOUND") toast.info("User or group admin not found")
      else if (error === "UNAUTHORIZED") toast.error("You don't have enough permission")
      else if (error === "INTERNAL_SERVER_ERROR") toast.error("There was an internal server error")
      else if (error === "UNAUTHORIZED_SELF_ASSIGN") toast.error("You cannot delete on yourself")
      else {
        toast.success("Group Admin deleted!")
        onDelete()
      }
    } catch (err) {
      toast.error("There was an error")
      console.error(err)
    } finally {
      setOpen(false)
      setPending(false)
    }
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
          <AlertDialogAction disabled={pending} onClick={deleteGroupAdmin} variant="destructive">
            {pending ? <Spinner /> : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
