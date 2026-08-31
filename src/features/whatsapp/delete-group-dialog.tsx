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
import { deleteWhatsappGroup } from "@/features/whatsapp/groups.functions"
import { errorMessage } from "@/lib/errors"

export function DeleteGroupDialog({ id, title }: { id: number; title: string }) {
  const router = useRouter()
  const deleteGroupFn = useServerFn(deleteWhatsappGroup)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function remove() {
    setPending(true)
    setError("")
    try {
      await deleteGroupFn({ data: { id } })
      toast.success(`${title} deleted.`)
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group could not be deleted. Check your permissions and try again."))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) setError("")
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="icon-sm" />}>
        <Trash2 />
        <span className="sr-only">Delete {title}</span>
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
          <AlertDialogDescription>This removes the group record. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
