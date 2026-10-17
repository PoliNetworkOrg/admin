import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { fieldControl, fieldHintId, FormDialog, FormField } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { createAzureMember } from "@/features/azure/azure.functions"
import { cn } from "@/lib/utils"

type MemberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}

const MEMBER_ID_ERROR = "Enter a valid positive member ID."
const EMAIL_ERROR = "Enter a valid email address."
const SAVE_ERROR = "The member could not be saved. Check the values and your permissions."

function isMemberId(value: string) {
  return /^[1-9]\d*$/.test(value)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** The backend's own messages ("This member number is already assigned.") are kept; anything else is generic. */
function saveError(caught: Error) {
  return caught.message === "" || caught.message === "UNAUTHORIZED" ? SAVE_ERROR : caught.message
}

/** Create a new member through the fixed backend workflow. */
export function MemberDialog({ open, onOpenChange, onSaved }: MemberDialogProps) {
  const createMember = useServerFn(createAzureMember)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [memberId, setMemberId] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const memberIdError = submitted && !isMemberId(memberId) ? MEMBER_ID_ERROR : undefined
  const emailError = submitted && !isEmail(email.trim()) ? EMAIL_ERROR : undefined
  const dirty = [firstName, lastName, email, memberId].some((value) => value.trim() !== "")
  const canSubmit = firstName.trim() !== "" && lastName.trim() !== "" && email.trim() !== "" && memberId !== ""

  async function submit() {
    setSubmitted(true)
    if (!isMemberId(memberId) || !isEmail(email.trim())) return
    const assocNumber = Number.parseInt(memberId, 10)

    try {
      await createMember({
        data: { firstName: firstName.trim(), lastName: lastName.trim(), assocNumber, sendEmailTo: email.trim() },
      })
    } catch (caught) {
      console.error(caught)
      throw new Error(caught instanceof Error ? saveError(caught) : SAVE_ERROR, { cause: caught })
    }
    await onSaved()
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create a member"
      description="Creates the association record and sends a welcome email."
      noun="member"
      dirty={dirty}
      canSubmit={canSubmit}
      submitLabel="Create member"
      onSubmit={submit}
    >
      {
        <>
          <div className="grid gap-4 min-[480px]:grid-cols-2">
            <FormField label="First name" htmlFor="m365-member-first-name">
              <Input
                id="m365-member-first-name"
                value={firstName}
                autoComplete="off"
                onChange={(event) => setFirstName(event.target.value)}
                className={cn("h-9", fieldControl)}
              />
            </FormField>
            <FormField label="Last name" htmlFor="m365-member-last-name">
              <Input
                id="m365-member-last-name"
                value={lastName}
                autoComplete="off"
                onChange={(event) => setLastName(event.target.value)}
                className={cn("h-9", fieldControl)}
              />
            </FormField>
          </div>
          <FormField
            label="Welcome email recipient"
            htmlFor="m365-member-email"
            hint="The welcome email with the sign-in details goes to this address."
            error={emailError}
          >
            <Input
              id="m365-member-email"
              type="email"
              value={email}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={fieldHintId("m365-member-email")}
              onChange={(event) => setEmail(event.target.value)}
              className={cn("h-9", fieldControl)}
            />
          </FormField>
        </>
      }
      <FormField label="Member ID" htmlFor="m365-member-id" error={memberIdError}>
        <Input
          id="m365-member-id"
          inputMode="numeric"
          value={memberId}
          autoComplete="off"
          aria-invalid={memberIdError ? true : undefined}
          aria-describedby={memberIdError ? fieldHintId("m365-member-id") : undefined}
          onChange={(event) => setMemberId(event.target.value.replace(/\D/g, ""))}
          className={cn("h-9 tabular-nums", fieldControl)}
        />
      </FormField>
    </FormDialog>
  )
}
