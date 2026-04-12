"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { OctagonX, Square, Trash2, Trash2Icon } from "lucide-react"
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
// import { useTRPC } from "@/server/trpc"

export function DeleteGrant({ userId }: { userId: number }) {
  const sesh = useSession()

  // const qc = useQueryClient()
  // const trpc = useTRPC()
  const removerId = sesh.data?.user.telegramId
  // const { mutateAsync } = useMutation(trpc.tg.grants.interrupt.mutationOptions())

  const [open, setOpen] = useState(false)

  async function interrupt() {
    if (!removerId) return toast.error("Invalid session, try to reload the page")
    // const { error } = await mutateAsync({ userId, interruptedById: removerId, sendTgLog: true })

    // if (error === "NOT_FOUND") toast.info("The grant was expired or already interrupted")
    // else if (error === "UNAUTHORIZED") toast.error("You don't have enought permission")
    // else if (error === "INTERNAL_SERVER_ERROR") toast.error("There was an internal server error")
    // else toast.success("Grant interrupted successfully")

    handleOpenChange(false)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v === false) {
      // qc.invalidateQueries(trpc.tg.grants.getOngoing.queryOptions())
      // qc.invalidateQueries(trpc.tg.grants.checkUser.queryOptions({ userId }))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button variant="destructive">
            <OctagonX />
            Interrupt
          </Button>
        }
      ></AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <OctagonX />
          </AlertDialogMedia>
          <AlertDialogTitle>Interrupt Grant</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to interrupt the grant?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={interrupt} variant="destructive">
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
