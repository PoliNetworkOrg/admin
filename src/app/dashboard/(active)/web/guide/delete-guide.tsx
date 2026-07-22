"use client"

import { useState } from "react"
import { FiAlertOctagon, FiTrash } from "react-icons/fi"
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
import { deleteGuide } from "@/server/actions/guides"

export function DeleteGuide({
  id,
  version,
  onDeleted,
}: {
  id: number
  version: string
  onDeleted: (id: number) => void
}) {
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    try {
      const { error } = await deleteGuide(id)

      if (error === "UNAUTHORIZED") toast.error("You don't have permission to delete guides.")
      else if (error === "NOT_FOUND") toast.info("This guide was already deleted.")
      else {
        toast.success("Guide deleted successfully")
        onDeleted(id)
      }
    } catch (err) {
      toast.error("There was an error")
      console.error(err)
    } finally {
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" size="icon" aria-label={`Delete ${version}`}>
            <FiTrash className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <FiAlertOctagon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete Guide</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete version <strong>{version}</strong>? <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} variant="destructive">
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
