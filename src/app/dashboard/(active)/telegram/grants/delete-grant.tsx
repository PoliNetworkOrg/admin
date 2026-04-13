"use client"

import { OctagonX } from "lucide-react"
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
import { interruptGrant } from "@/server/actions/grants"

export function DeleteGrant({ userId, onDelete }: { userId: number; onDelete(): void }) {
  const sesh = useSession()
  const removerId = sesh.data?.user.telegramId

  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function interrupt() {
    if (!removerId) return toast.error("Invalid session, try to reload the page")
    const { error } = await interruptGrant({ userId, interruptedById: removerId, sendTgLog: true })

    if (error === "NOT_FOUND") toast.info("The grant was expired or already interrupted")
    else if (error === "UNAUTHORIZED") toast.error("You don't have enough permission")
    else if (error === "INTERNAL_SERVER_ERROR") toast.error("There was an internal server error")
    else {
      toast.success("Grant interrupted successfully")
      router.refresh()
      onDelete()
    }

    handleOpenChange(false)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
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
