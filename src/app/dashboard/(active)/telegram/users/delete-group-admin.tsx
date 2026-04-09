"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
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
import { useTRPC } from "@/lib/trpc/client"

export function DeleteGroupAdmin({ userId, chatId }: { userId: number; chatId: number }) {
  const router = useRouter()
  const sesh = useSession()

  const qc = useQueryClient()
  const trpc = useTRPC()
  const removerId = sesh.data?.user.telegramId
  const { mutateAsync } = useMutation(trpc.tg.permissions.removeGroup.mutationOptions())

  const [open, setOpen] = useState(false)

  async function deleteGroupAdmin() {
    if (!removerId) return toast.error("Invalid session, try to reload the page")
    const { error } = await mutateAsync({ removerId, userId, groupId: chatId })
    if (error) {
      toast.error("There was an error")
      console.error(error)
    } else {
      toast.success("Group Admin deleted!")
    }

    handleOpenChange(false)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v === false) {
      qc.invalidateQueries(trpc.tg.permissions.getRoles.queryOptions({ userId }))
      router.refresh()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>}></AlertDialogTrigger>
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
