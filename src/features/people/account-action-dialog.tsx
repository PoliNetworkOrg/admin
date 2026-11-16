import { useServerFn } from "@tanstack/react-start"
import { Mail, RefreshCw, X } from "lucide-react"

import { ConfirmDialog } from "@/components/primitives"

import { useRefreshAfter } from "./people-hooks"
import { revokePersonInvite, sendPersonInvite } from "./people-invites.functions"

export type AccountAction = {
  kind: "invite" | "resend" | "revoke"
  personId: string
  name: string
  /** The invite address: the record's contact email. */
  email: string
}

/** Send, resend or revoke an invite. Keep `action` after closing so the text survives the exit. */
export function AccountActionDialog({
  action,
  open,
  onOpenChange,
}: {
  action: AccountAction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const send = useServerFn(sendPersonInvite)
  const revoke = useServerFn(revokePersonInvite)
  const refresh = useRefreshAfter()
  if (!action) return null
  const data = { personId: action.personId }

  if (action.kind === "invite" || action.kind === "resend") {
    const resend = action.kind === "resend"
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        tone="primary"
        icon={resend ? RefreshCw : Mail}
        title={resend ? "Resend invite?" : "Send invite?"}
        description={`${action.name} gets an email at ${action.email} with a link that works once. They can sign in with any account, not only this address. It expires in 14 days${resend ? ", and the previous link stops working." : "."}`}
        confirmLabel={resend ? "Resend invite" : "Send invite"}
        onConfirm={async () => {
          await send({ data })
          await refresh(resend ? "Invite resent." : "Invite sent.")
        }}
      />
    )
  }
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={X}
      title="Revoke invite?"
      description={`The link sent to ${action.email} stops working. ${action.name} stays on the list as Not linked.`}
      confirmLabel="Revoke invite"
      onConfirm={async () => {
        await revoke({ data })
        await refresh("Invite revoked.")
      }}
    />
  )
}
