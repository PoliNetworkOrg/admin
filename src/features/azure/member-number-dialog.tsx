import { useServerFn } from "@tanstack/react-start"
import { Hash } from "lucide-react"
import { useState } from "react"

import {
  checkboxControl,
  ConfirmDialog,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
} from "@/components/primitives"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { setAzureMemberNumber } from "@/features/azure/azure.functions"
import type { AzureMember } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { isMemberNumber } from "./member-number"

type MemberNumberDialogProps = {
  member: AzureMember
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shows the new member ID in the table right away; returns the function that reverts it. */
  onOptimisticUpdate: (memberId: string, employeeId: string) => () => void
  /** Runs after the number is saved, before the dialog closes; `notified` is null when no email was asked for. */
  onSaved: (notified: boolean | null) => Promise<void>
}

const MEMBER_ID_ERROR = "Enter a valid positive member ID."
const EMAIL_ERROR = "Enter a valid email address."
const SAVE_ERROR = "The member ID could not be changed. Check the value and your permissions."

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** The backend's own messages ("Member number 12 is already assigned to …") are kept; anything else is generic. */
function saveError(caught: Error) {
  return caught.message === "" || caught.message === "UNAUTHORIZED" ? SAVE_ERROR : caught.message
}

/** Change the member ID of an existing member, after a confirmation, optionally emailing them the new one. */
export function MemberNumberDialog({
  member,
  open,
  onOpenChange,
  onOptimisticUpdate,
  onSaved,
}: MemberNumberDialogProps) {
  const setMemberNumber = useServerFn(setAzureMemberNumber)
  const initialMemberId = member.employeeId ?? ""
  const [memberId, setMemberId] = useState(initialMemberId)
  const [notify, setNotify] = useState(true)
  const [email, setEmail] = useState(member.mail ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const recipient = email.trim()
  const memberIdError = submitted && !isMemberNumber(memberId) ? MEMBER_ID_ERROR : undefined
  const emailError = submitted && notify && !isEmail(recipient) ? EMAIL_ERROR : undefined
  const changed = memberId !== initialMemberId
  const dirty = changed || !notify || email !== (member.mail ?? "")
  const canSubmit = changed && memberId !== "" && (!notify || recipient !== "")
  const name = member.displayName ?? member.mail ?? "this member"

  function submit() {
    setSubmitted(true)
    if (!isMemberNumber(memberId) || (notify && !isEmail(recipient))) return
    setConfirming(true)
  }

  async function save() {
    const revert = onOptimisticUpdate(member.id, memberId)
    let notified: boolean | null
    try {
      const result = await setMemberNumber({
        data: {
          userId: member.id,
          assocNumber: Number.parseInt(memberId, 10),
          notifyEmail: notify ? recipient : undefined,
        },
      })
      notified = result.notificationSent ?? null
    } catch (caught) {
      console.error(caught)
      revert()
      throw new Error(caught instanceof Error ? saveError(caught) : SAVE_ERROR, { cause: caught })
    }
    await onSaved(notified)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change member ID"
      description={
        <>
          {name}
          {member.mail && member.displayName ? (
            <>
              {" · "}
              <span className="font-mono break-all">{member.mail}</span>
            </>
          ) : null}
        </>
      }
      noun="member"
      dirty={dirty}
      canSubmit={canSubmit}
      submitLabel="Change member ID"
      onSubmit={submit}
    >
      <FormField
        label="New member ID"
        htmlFor="m365-member-number"
        hint={member.employeeId ? `Currently #${member.employeeId}.` : "No member ID yet."}
        error={memberIdError}
      >
        <Input
          id="m365-member-number"
          inputMode="numeric"
          value={memberId}
          autoComplete="off"
          aria-invalid={memberIdError ? true : undefined}
          aria-describedby={fieldHintId("m365-member-number")}
          onChange={(event) => setMemberId(event.target.value)}
          className={cn("h-9 tabular-nums", fieldControl)}
        />
      </FormField>
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={notify} onCheckedChange={setNotify} className={checkboxControl} />
        <span className="text-[13px] leading-5 font-medium text-(--pn-fg)">Email the member the new ID</span>
      </label>
      {notify && (
        <FormField
          label="Send the email to"
          htmlFor="m365-member-number-email"
          hint="Microsoft 365 or personal email."
          error={emailError}
        >
          <Input
            id="m365-member-number-email"
            type="email"
            value={email}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={fieldHintId("m365-member-number-email")}
            onChange={(event) => setEmail(event.target.value)}
            className={cn("h-9", fieldControl)}
          />
        </FormField>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change member ID?"
        description={
          <>
            {name} goes from {member.employeeId ? `#${member.employeeId}` : "no member ID"} to{" "}
            <strong className="font-semibold text-(--pn-fg)">#{memberId}</strong>.{" "}
            {notify ? (
              <>
                An email with the new ID goes to <span className="font-mono break-all">{recipient}</span>.
              </>
            ) : (
              "No email is sent."
            )}
          </>
        }
        confirmLabel="Change member ID"
        tone="primary"
        icon={Hash}
        onConfirm={save}
      />
    </FormDialog>
  )
}
