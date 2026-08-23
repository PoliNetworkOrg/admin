import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createAzureMember, setAzureMemberNumber } from "@/features/azure/azure.functions"
import type { AzureMember } from "@/lib/api/types"

export type MemberDialogState = { mode: "create" } | { mode: "edit"; member: AzureMember }

export function MemberDialog({
  dialog,
  onClose,
  onOptimisticUpdate,
  onSaved,
}: {
  dialog: MemberDialogState
  onClose: () => void
  onOptimisticUpdate: (member: AzureMember) => () => void
  onSaved: (mode: "create" | "edit") => Promise<void>
}) {
  const editing = dialog.mode === "edit"
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [memberId, setMemberId] = useState(editing ? (dialog.member.employeeId ?? "") : "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const createMember = useServerFn(createAzureMember)
  const setMemberNumber = useServerFn(setAzureMemberNumber)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    const assocNumber = Number.parseInt(memberId, 10)
    if (!Number.isInteger(assocNumber) || assocNumber <= 0) {
      setError("Enter a valid positive member ID.")
      setPending(false)
      return
    }
    let rollback: (() => void) | undefined
    try {
      if (editing) {
        rollback = onOptimisticUpdate({ ...dialog.member, employeeId: String(assocNumber), isMember: true })
        await setMemberNumber({ data: { userId: dialog.member.id, assocNumber } })
        await onSaved("edit")
      } else {
        await createMember({ data: { firstName, lastName, assocNumber, sendEmailTo: email } })
        await onSaved("create")
      }
    } catch (error) {
      console.error(error)
      rollback?.()
      setError("The member could not be saved. Check the values and your permissions.")
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
            AZURE MEMBERS
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
            {editing ? "Set member ID" : "Create a member"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editing
              ? "Update the association number linked to this Azure account."
              : "Create a member association and send a welcome email."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <FieldGroup className="gap-3.5">
            {!editing && (
              <>
                <Field>
                  <FieldLabel htmlFor="first-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    First name
                  </FieldLabel>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    Last name
                  </FieldLabel>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor="welcome-email"
                    className="font-mono text-[10px] font-medium text-muted-foreground"
                  >
                    Welcome email recipient
                  </FieldLabel>
                  <Input
                    id="welcome-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor="member-id" className="font-mono text-[10px] font-medium text-muted-foreground">
                Member ID
              </FieldLabel>
              <Input
                id="member-id"
                inputMode="numeric"
                pattern="[0-9]+"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value.replace(/\D/g, ""))}
                required
                autoFocus={editing}
              />
            </Field>
            {error && <p className="text-[10px] leading-[1.5] text-destructive">{error}</p>}
          </FieldGroup>
          <DialogFooter className="-mx-6 -mb-5 mt-2 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {editing ? "Save member ID" : "Create member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
