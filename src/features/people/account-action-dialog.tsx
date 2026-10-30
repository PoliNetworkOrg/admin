import { useServerFn } from "@tanstack/react-start"
import { Mail, RefreshCw, Unlink, X } from "lucide-react"

import { ConfirmDialog } from "@/components/primitives"

import { useRefreshAfter } from "./people-hooks"
import { revokePersonInvite, sendPersonInvite, unlinkPersonAccount } from "./people-write.functions"

export type AccountAction = {
  kind: "invite" | "resend" | "revoke" | "unlink"
  personId: string
  name: string
  /** The invite address, or the linked sign-in for `unlink`. */
  email: string
}

/** Send, resend or revoke an invite, or unlink an account. Keep `action` after closing so the text survives the exit. */
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
  const unlink = useServerFn(unlinkPersonAccount)
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
        description={`${action.name} gets an email at ${action.email} with a link to sign in and link their account. The link expires in 14 days${resend ? " and the previous one stops working." : "."}`}
        confirmLabel={resend ? "Resend invite" : "Send invite"}
        onConfirm={async () => {
          await send({ data })
          await refresh(resend ? "Invite resent." : "Invite sent.")
        }}
      />
    )
  }
  if (action.kind === "revoke") {
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
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Unlink}
      title="Unlink account?"
      description={`${action.email} can no longer see ${action.name}'s record. The record and its history stay.`}
      confirmLabel="Unlink account"
      onConfirm={async () => {
        await unlink({ data })
        await refresh("Account unlinked.")
      }}
    />
  )
}
