import { useServerFn } from "@tanstack/react-start"
import { Download } from "lucide-react"
import { useState } from "react"

import {
  ConfirmDialog,
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  InlineAlert,
  RadioCard,
  RadioCardGroup,
  SelectField,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { saveBlob } from "./people-files"
import { currentYear, FEE_STATUS, MEMBER_STATUS, todayIso } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { createMember, exportMembers, setMemberNumber, setMemberStatus } from "./people-members.functions"
import { type PersonOption, PersonPicker } from "./people-ui"
import { MEMBER_STATUSES, type MemberStatus } from "./people.contract"

type NewFee = "due" | "paid"

const NUMBER_PATTERN = /^\d{4}$/
const NEW_FEES = ["due", "paid"] satisfies NewFee[]

/** The lowest unused four-digit number after the highest one: numbers are never reused. */
export function nextMemberNumber(numbers: readonly string[]) {
  const highest = numbers.reduce((max, number) => Math.max(max, Number(number)), 0)
  return String(highest + 1).padStart(4, "0")
}

/** Registers a person as a member; the backend's new-member workflow creates their Microsoft 365 account. */
export function AddMemberDialog({
  open,
  onOpenChange,
  candidates,
  initialPerson = null,
  nextNumber,
  takenNumbers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** People who aren't members, by name. */
  candidates: readonly PersonOption[]
  initialPerson?: PersonOption | null
  nextNumber: string
  takenNumbers: ReadonlySet<string>
}) {
  const create = useServerFn(createMember)
  const refresh = useRefreshAfter()
  const [person, setPerson] = useState(initialPerson)
  const [number, setNumber] = useState(nextNumber)
  const [admittedOn, setAdmittedOn] = useState(todayIso())
  const [fee, setFee] = useState<NewFee>("due")
  const [submitted, setSubmitted] = useState(false)

  const trimmed = number.trim()
  const personError = submitted && !person ? "Choose a person." : undefined
  const numberError = !submitted
    ? undefined
    : !NUMBER_PATTERN.test(trimmed)
      ? "Enter four digits."
      : takenNumbers.has(trimmed)
        ? `${trimmed} is already taken. Numbers are never reused.`
        : undefined
  const dateError = submitted && !admittedOn ? "Choose the admission date." : undefined

  async function submit() {
    setSubmitted(true)
    if (!person || !NUMBER_PATTERN.test(trimmed) || takenNumbers.has(trimmed) || !admittedOn) return
    try {
      await create({ data: { personId: person.id, number: trimmed, admittedOn, fee } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't add the member. Try again."), { cause: caught })
    }
    await refresh(`${person.name} added as member ${trimmed}.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add member"
      description="Registers a person as a member and starts the new-member workflow."
      noun="member"
      dirty={person?.id !== initialPerson?.id || number !== nextNumber || fee !== "due" || admittedOn !== todayIso()}
      submitLabel="Add member"
      onSubmit={submit}
      notice={
        <InlineAlert tone="info">
          The new-member workflow creates {person ? `${person.name}'s` : "the person's"} Microsoft 365 account with
          member ID {NUMBER_PATTERN.test(trimmed) ? trimmed : "above"}.
        </InlineAlert>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField label="Person" htmlFor="member-person" hint="Ask HR to add missing people." error={personError}>
          <PersonPicker
            id="member-person"
            people={candidates}
            value={person}
            onChange={setPerson}
            invalid={!!personError}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 shell:grid-cols-2">
          <FormField label="Member number" htmlFor="member-number" hint="Next free number." error={numberError}>
            <Input
              id="member-number"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              aria-invalid={numberError ? true : undefined}
              aria-describedby={fieldHintId("member-number")}
              className={cn(fieldControl, "font-mono")}
            />
          </FormField>
          <FormField label="Admitted on" htmlFor="member-admitted" error={dateError}>
            <DateField
              id="member-admitted"
              value={admittedOn}
              onChange={setAdmittedOn}
              invalid={!!dateError}
              describedBy={dateError ? fieldHintId("member-admitted") : undefined}
            />
          </FormField>
        </div>
        <FormField label={`Fee ${currentYear()}`} htmlFor="member-fee">
          <SelectField<NewFee>
            id="member-fee"
            value={fee}
            options={NEW_FEES.map((value) => ({ value, label: FEE_STATUS[value].label }))}
            onChange={setFee}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

type MemberTarget = { personId: string; name: string; number: string; status: MemberStatus; m365Email: string }

/** Active, suspended, expired or former, with an optional reason saved in the activity. */
export function MemberStatusDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: MemberTarget
}) {
  const save = useServerFn(setMemberStatus)
  const refresh = useRefreshAfter()
  const [status, setStatus] = useState(member.status)
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  // Suspending or ending a membership needs a reason; reactivating doesn't.
  const reasonRequired = status !== "active"
  const reasonError = submitted && reasonRequired && !reason.trim() ? "Enter a reason." : undefined

  async function submit() {
    if (status === member.status) {
      onOpenChange(false)
      return
    }
    setSubmitted(true)
    if (reasonRequired && !reason.trim()) return
    try {
      await save({ data: { personId: member.personId, status, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't change the status. Try again."), { cause: caught })
    }
    await refresh("Member status changed.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      description={`${member.name} · member ${member.number}. The Microsoft 365 account follows: suspended and former members can't sign in.`}
      noun="status change"
      dirty={status !== member.status || reason.trim() !== ""}
      submitLabel="Change status"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <RadioCardGroup label="Status" hideLabel value={status} onValueChange={setStatus}>
          {MEMBER_STATUSES.map((value) => (
            <RadioCard
              key={value}
              value={value}
              label={MEMBER_STATUS[value].label}
              description={MEMBER_STATUS[value].description}
            />
          ))}
        </RadioCardGroup>
        <FormField
          label="Reason"
          htmlFor="member-status-reason"
          optional={!reasonRequired}
          hint="Shown in the record's activity."
          error={reasonError}
        >
          <Textarea
            id="member-status-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            aria-describedby={fieldHintId("member-status-reason")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

/** A new number for an existing member; the Microsoft 365 member ID follows. */
export function MemberNumberDialog({
  open,
  onOpenChange,
  member,
  nextNumber,
  takenNumbers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: MemberTarget
  /** Known only where the whole register is loaded. */
  nextNumber?: string
  takenNumbers?: ReadonlySet<string>
}) {
  const save = useServerFn(setMemberNumber)
  const refresh = useRefreshAfter()
  const [number, setNumber] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const trimmed = number.trim()
  const error = !submitted
    ? undefined
    : !NUMBER_PATTERN.test(trimmed)
      ? "Enter four digits."
      : trimmed === member.number
        ? `${member.name} already has ${trimmed}.`
        : takenNumbers?.has(trimmed)
          ? `${trimmed} is already taken. Numbers are never reused.`
          : undefined

  async function submit() {
    setSubmitted(true)
    if (!NUMBER_PATTERN.test(trimmed) || trimmed === member.number || takenNumbers?.has(trimmed)) return
    try {
      await save({ data: { personId: member.personId, number: trimmed } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't change the member number. Try again."), { cause: caught })
    }
    await refresh("Member number changed.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change member number"
      description={`${member.name}'s number changes from ${member.number} to the one below. Numbers are never reused.`}
      noun="member number"
      dirty={trimmed !== ""}
      submitLabel="Change member number"
      onSubmit={submit}
      notice={
        <InlineAlert tone="info">
          The Microsoft 365 account <span className="font-mono [overflow-wrap:anywhere]">{member.m365Email}</span> gets
          the new member ID too.
        </InlineAlert>
      }
    >
      <FormField
        label="New member number"
        htmlFor="member-new-number"
        hint={nextNumber ? `Four digits. ${nextNumber} is the next free number.` : "Four digits."}
        error={error}
      >
        <Input
          id="member-new-number"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldHintId("member-new-number")}
          className={cn(fieldControl, "font-mono")}
        />
      </FormField>
    </FormDialog>
  )
}

/** Confirms first: the file holds personal data. */
export function ExportMembersDialog({
  open,
  onOpenChange,
  count,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
}) {
  const exportRegister = useServerFn(exportMembers)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="primary"
      icon={Download}
      title="Export member register?"
      description={`The file holds personal data of ${pluralize(count, "member")}: names, numbers, emails and fee status. Keep it in the association's OneDrive and delete local copies.`}
      confirmLabel="Export register"
      onConfirm={async () => {
        const file = await exportRegister()
        saveBlob(new Blob([file.csv], { type: "text/csv;charset=utf-8" }), file.filename)
        appToast.success("Member register exported.")
      }}
    />
  )
}
