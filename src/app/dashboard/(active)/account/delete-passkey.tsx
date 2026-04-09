"use client"

import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
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
import { auth } from "@/lib/auth"

export function DeletePasskey({ id }: { id: string }) {
  const router = useRouter()

  async function deletePasskey() {
    const { data, error } = await auth.passkey.deletePasskey({ id })
    if (!data || error) return toast.error("There was an error")
    toast.success("Passkey deleted!")
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>}></AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove passkey</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to delete this passkey?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deletePasskey} variant="destructive">
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
