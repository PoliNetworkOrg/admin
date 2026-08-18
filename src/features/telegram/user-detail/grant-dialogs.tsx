import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, ShieldX } from "lucide-react"
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
import { interruptTelegramGrant } from "@/features/telegram/grants.functions"

export function InterruptGrantDialog({ userId, displayName }: { userId: number; displayName: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const interruptGrant = useServerFn(interruptTelegramGrant)

  async function interrupt() {
    if (pending) return
    setPending(true)
    try {
      const result = await interruptGrant({ data: { userId } })
      if (result.error) {
        toast.error(grantMutationError(result.error))
        return
      }

      toast.success(`Grant interrupted for ${displayName}.`)
      setOpen(false)
      try {
        await router.invalidate({ sync: true })
      } catch {
        toast.warning("The grant was ended, but the latest user data could not be refreshed.")
      }
    } catch (error) {
      console.error(error)
      toast.error("The grant could not be ended. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <ShieldX /> End grant
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <ShieldX />
          </AlertDialogMedia>
          <AlertDialogTitle>End grant?</AlertDialogTitle>
          <AlertDialogDescription>
            {displayName} will immediately return to the normal automatic moderation rules.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void interrupt()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            End grant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function grantMutationError(error: string) {
  if (error === "NOT_FOUND") return "This grant has already expired or been removed."
  if (error === "UNAUTHORIZED") return "You do not have permission to manage grants."
  return "The grant update could not be completed."
}
