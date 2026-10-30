import { useServerFn } from "@tanstack/react-start"
import { CircleAlert, TriangleAlert } from "lucide-react"
import { useState } from "react"

import {
  ConfirmDialog,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  SegmentedControl,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { createAzureMember } from "@/features/azure/azure.functions"
import { cn } from "@/lib/utils"

import { isLocalPart, isPoliNetworkAddress, MAIL_DOMAIN, type MailboxKind, standardLocalPart } from "./mailbox"
import { isMemberNumber } from "./member-number"

type MemberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (welcomeMailSent: boolean) => Promise<void>
}

const MEMBER_ID_ERROR = "Enter a valid positive member ID."
const EMAIL_ERROR = "Enter a valid email address."
const SAME_ADDRESS_ERROR = "This is the address being created and has no mailbox yet. Use the member's personal email."
const LOCAL_PART_ERROR = "Use lowercase letters and digits, with single dots or hyphens between them."
const STANDARD_ERROR = "This name can't form a standard address. Choose Custom."
const SAVE_ERROR = "The member could not be saved. Check the values and your permissions."

const MAILBOX_KINDS = [
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
] as const

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** The backend's own messages ("The address … is already in use.") are kept; anything else is generic. */
function saveError(caught: Error) {
  return caught.message === "" || caught.message === "UNAUTHORIZED" ? SAVE_ERROR : caught.message
}

/** Create a new member through the fixed backend workflow, choosing their Microsoft 365 address. */
export function MemberDialog({ open, onOpenChange, onSaved }: MemberDialogProps) {
  const createMember = useServerFn(createAzureMember)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [mailbox, setMailbox] = useState<MailboxKind>("standard")
  const [customLocalPart, setCustomLocalPart] = useState("")
  const [email, setEmail] = useState("")
  const [memberId, setMemberId] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [confirmingRecipient, setConfirmingRecipient] = useState(false)

  const namesGiven = firstName.trim() !== "" && lastName.trim() !== ""
  const standard = namesGiven ? standardLocalPart(firstName, lastName) : null
  const localPart = mailbox === "standard" ? standard : isLocalPart(customLocalPart) ? customLocalPart : null
  const address = localPart === null ? null : `${localPart}@${MAIL_DOMAIN}`
  const recipient = email.trim()
  const sameAddress = address !== null && recipient.toLowerCase() === address

  const addressError =
    mailbox === "standard"
      ? namesGiven && standard === null
        ? STANDARD_ERROR
        : undefined
      : submitted && localPart === null
        ? LOCAL_PART_ERROR
        : undefined
  const memberIdError = submitted && !isMemberNumber(memberId) ? MEMBER_ID_ERROR : undefined
  const emailError = submitted
    ? !isEmail(recipient)
      ? EMAIL_ERROR
      : sameAddress
        ? SAME_ADDRESS_ERROR
        : undefined
    : undefined
  const dirty = [firstName, lastName, customLocalPart, email, memberId].some((value) => value.trim() !== "")
  const canSubmit =
    namesGiven &&
    recipient !== "" &&
    memberId !== "" &&
    (mailbox === "standard" ? standard !== null : customLocalPart !== "")

  async function create() {
    if (localPart === null) return
    let welcomeMailSent: boolean
    try {
      const result = await createMember({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          assocNumber: Number.parseInt(memberId, 10),
          sendEmailTo: recipient,
          mailbox: mailbox === "custom" ? { kind: "custom", localPart } : { kind: "standard" },
        },
      })
      welcomeMailSent = result.welcomeMailSent
    } catch (caught) {
      console.error(caught)
      throw new Error(caught instanceof Error ? saveError(caught) : SAVE_ERROR, { cause: caught })
    }
    await onSaved(welcomeMailSent)
    onOpenChange(false)
  }

  async function submit() {
    setSubmitted(true)
    if (localPart === null || !isMemberNumber(memberId) || !isEmail(recipient) || sameAddress) return
    // The welcome email carries the new account's credentials, so it normally goes to a personal address.
    if (isPoliNetworkAddress(recipient)) {
      setConfirmingRecipient(true)
      return
    }
    await create()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create a member"
      description="Adds a new Microsoft 365 account to Soci."
      noun="member"
      dirty={dirty}
      canSubmit={canSubmit}
      submitLabel="Create member"
      onSubmit={submit}
    >
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
      <div role="group" aria-labelledby="m365-member-address-label" className="flex flex-col gap-1.5">
        <span id="m365-member-address-label" className="text-[13px] leading-5 font-medium text-(--pn-fg)">
          New Microsoft 365 address
        </span>
        <SegmentedControl label="Address format" items={MAILBOX_KINDS} value={mailbox} onValueChange={setMailbox} />
        {mailbox === "standard" ? (
          <output
            aria-live="polite"
            aria-describedby={fieldHintId("m365-member-address")}
            className={cn(
              "flex min-h-9 items-center rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-muted) px-3 font-mono text-[13px] break-all",
              address ? "text-(--pn-fg)" : "text-(--pn-fg-subtle)"
            )}
          >
            {address ?? `firstname.lastname@${MAIL_DOMAIN}`}
          </output>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              id="m365-member-local-part"
              value={customLocalPart}
              autoComplete="off"
              spellCheck={false}
              aria-label="Address before @polinetwork.org"
              aria-invalid={addressError ? true : undefined}
              aria-describedby={fieldHintId("m365-member-address")}
              onChange={(event) => setCustomLocalPart(event.target.value.replace(/\s/g, "").toLowerCase())}
              className={cn("h-9 min-w-0 flex-1 font-mono", fieldControl)}
            />
            <span className="shrink-0 font-mono text-[13px] text-(--pn-fg-muted)">@{MAIL_DOMAIN}</span>
          </div>
        )}
        {addressError ? (
          <p
            id={fieldHintId("m365-member-address")}
            className="flex items-center gap-1.5 text-xs text-(--pn-danger-fg)"
          >
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {addressError}
          </p>
        ) : (
          <p id={fieldHintId("m365-member-address")} className="text-xs text-(--pn-fg-muted)">
            {mailbox === "standard"
              ? "Built from the first and last name, without accents, apostrophes or spaces."
              : "Lowercase letters, digits, dots and hyphens."}
          </p>
        )}
      </div>
      <FormField
        label="Send the welcome email to"
        htmlFor="m365-member-email"
        hint="Use the member's personal email."
        error={emailError}
      >
        <Input
          id="m365-member-email"
          type="email"
          value={email}
          autoComplete="off"
          spellCheck={false}
          placeholder="name@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={fieldHintId("m365-member-email")}
          onChange={(event) => setEmail(event.target.value)}
          className={cn("h-9", fieldControl)}
        />
      </FormField>
      <FormField label="Member ID" htmlFor="m365-member-id" error={memberIdError}>
        <Input
          id="m365-member-id"
          inputMode="numeric"
          value={memberId}
          autoComplete="off"
          aria-invalid={memberIdError ? true : undefined}
          aria-describedby={memberIdError ? fieldHintId("m365-member-id") : undefined}
          onChange={(event) => setMemberId(event.target.value)}
          className={cn("h-9 tabular-nums", fieldControl)}
        />
      </FormField>
      <ConfirmDialog
        open={confirmingRecipient}
        onOpenChange={setConfirmingRecipient}
        title="Send credentials to a PoliNetwork address?"
        description={
          <>
            <span className="font-mono break-all">{recipient}</span> will receive the sign-in details for{" "}
            <span className="font-mono break-all">{address}</span>.
          </>
        }
        confirmLabel="Send to this address"
        cancelLabel="Change recipient"
        tone="primary"
        icon={TriangleAlert}
        onConfirm={create}
      />
    </FormDialog>
  )
}
