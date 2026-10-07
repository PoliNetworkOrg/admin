import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"

import { ConfirmDialog } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { failWith, refreshAfterMutation } from "@/components/telegram/telegram-user"
import { interruptTelegramGrant } from "@/features/telegram/grants.functions"

function grantMutationError(error: string) {
  if (error === "NOT_FOUND") return "This grant has already expired or been removed."
  if (error === "UNAUTHORIZED") return "You do not have permission to manage grants."
  return "The grant update could not be completed."
}

type InterruptGrantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userName: string
}

/** Ends the user's ongoing grant; the backend interrupts by user, not by grant id. */
export function InterruptGrantDialog({ open, onOpenChange, userId, userName }: InterruptGrantDialogProps) {
  const router = useRouter()
  const interruptGrant = useServerFn(interruptTelegramGrant)

  async function interrupt() {
    const result = await failWith(
      interruptGrant({ data: { userId } }),
      "The grant could not be ended. Check your permissions and try again."
    )
    if (result.error) {
      console.error(result.error)
      throw new Error(grantMutationError(result.error))
    }
    appToast.success(`Grant ended for ${userName}.`)
    await refreshAfterMutation(router, "The grant was ended, but the latest user data could not be refreshed.")
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="End grant?"
      description={`${userName} will immediately return to the normal automatic moderation rules.`}
      confirmLabel="End grant"
      onConfirm={interrupt}
    />
  )
}
