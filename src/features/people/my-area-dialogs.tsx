import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { fieldControl, fieldHintId, FormDialog, FormField, SelectField } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { errorMessage, useRefreshAfter } from "./people-hooks"
import { answerMyCensus, askToBeAdded, requestCorrection } from "./people-self.functions"
import { ChoiceChips } from "./people-ui"
import {
  type AnswerCensusInput,
  CORRECTION_FIELDS,
  type CorrectionField,
  TELEGRAM_USERNAME_PATTERN,
} from "./people.contract"

const LEAVING_REASONS = ["Graduating", "No longer have time", "Going abroad", "Other"] as const
type LeavingReason = (typeof LEAVING_REASONS)[number]

/** The census "No": team roles end immediately; HR completes Telegram removals. */
export function LeavingDialog({
  open,
  onOpenChange,
  year,
  answer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: string
  /** The rest of the census form, as filled in on the page. */
  answer: Omit<AnswerCensusInput, "answer" | "reason" | "note">
}) {
  const save = useServerFn(answerMyCensus)
  const refresh = useRefreshAfter()
  const [reason, setReason] = useState<LeavingReason | null>(null)
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const reasonError = submitted && !reason ? "Choose a reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!reason) return
    try {
      await save({ data: { ...answer, answer: "leaving", reason, note: note.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Your answer couldn't be saved. Try again."), { cause: caught })
    }
    await refresh("Answer saved.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Leave PoliNetwork for ${year}?`}
      description="Your team roles end today. HR completes Telegram admin removals. Your history stays, and you can come back any year."
      noun="answer"
      dirty={reason !== null || note.trim() !== ""}
      submitLabel="Confirm I'm leaving"
      tone="danger"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <FormField label="Reason" htmlFor="leaving-reason" error={reasonError}>
          <SelectField<LeavingReason>
            id="leaving-reason"
            value={reason}
            options={LEAVING_REASONS.map((value) => ({ value, label: value }))}
            onChange={setReason}
            placeholder="Choose a reason"
            invalid={!!reasonError}
          />
        </FormField>
        <FormField label="Anything to tell HR" htmlFor="leaving-note" optional>
          <Textarea
            id="leaving-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            aria-describedby={fieldHintId("leaving-note")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

/** People can't edit their record: HR checks the change and updates it. */
export function CorrectionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const send = useServerFn(requestCorrection)
  const refresh = useRefreshAfter()
  const [field, setField] = useState<CorrectionField | null>(null)
  const [value, setValue] = useState("")
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const fieldError = submitted && !field ? "Choose a field." : undefined
  const valueError = submitted && !value.trim() ? "Enter the correct value." : undefined

  async function submit() {
    setSubmitted(true)
    if (!field || !value.trim()) return
    try {
      await send({ data: { field, value: value.trim(), note: note.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't send the request. Try again."), { cause: caught })
    }
    await refresh("Correction requested.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request a correction"
      description="HR checks the change and updates your record."
      noun="request"
      dirty={field !== null || value.trim() !== "" || note.trim() !== ""}
      submitLabel="Send request"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <FormField label="What's wrong" htmlFor="correction-field" error={fieldError}>
          <SelectField<CorrectionField>
            id="correction-field"
            value={field}
            options={CORRECTION_FIELDS.map((option) => ({ value: option, label: option }))}
            onChange={setField}
            placeholder="Choose a field"
            invalid={!!fieldError}
          />
        </FormField>
        <FormField label="Correct value" htmlFor="correction-value" error={valueError}>
          <Input
            id="correction-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={200}
            autoComplete="off"
            aria-invalid={valueError ? true : undefined}
            aria-describedby={fieldHintId("correction-value")}
            className={fieldControl}
          />
        </FormField>
        <FormField label="Note" htmlFor="correction-note" optional>
          <Textarea
            id="correction-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            aria-describedby={fieldHintId("correction-note")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

const ROLE_OPTIONS = {
  "PoliNetwork admin": "admin",
  "Team member": "team",
  "Member (socio)": "member",
} satisfies Record<string, AskRole>
type AskRole = "admin" | "team" | "member"

function roleOf(label: string): AskRole | undefined {
  return Object.entries(ROLE_OPTIONS).find(([option]) => option === label)?.[1]
}

/** For a sign-in with no record: HR adds the person or links them to their record. */
export function AskToBeAddedDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const send = useServerFn(askToBeAdded)
  const refresh = useRefreshAfter()
  const [what, setWhat] = useState<string[]>([])
  const [groupsOrTeam, setGroupsOrTeam] = useState("")
  const [telegram, setTelegram] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const whatError = submitted && what.length === 0 ? "Choose at least one." : undefined
  const telegramError =
    submitted && telegram.trim() && !TELEGRAM_USERNAME_PATTERN.test(telegram.trim())
      ? "Enter 5–32 letters, digits or underscores."
      : undefined

  async function submit() {
    setSubmitted(true)
    const roles = what.flatMap((label) => roleOf(label) ?? [])
    if (roles.length === 0 || (telegram.trim() && !TELEGRAM_USERNAME_PATTERN.test(telegram.trim()))) return
    try {
      await send({ data: { roles, groupsOrTeam: groupsOrTeam.trim(), telegramUsername: telegram.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't send the request. Try again."), { cause: caught })
    }
    await refresh("Request sent.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ask to be added"
      description="HR adds you or links you to your record. We'll email you when it's done."
      noun="request"
      dirty={what.length > 0 || groupsOrTeam.trim() !== "" || telegram.trim() !== ""}
      submitLabel="Send request"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <FormField label="What do you do at PoliNetwork" htmlFor="ask-what" error={whatError}>
          <ChoiceChips
            id="ask-what"
            label="What do you do at PoliNetwork"
            options={Object.keys(ROLE_OPTIONS)}
            value={what}
            onChange={setWhat}
          />
        </FormField>
        <FormField label="Groups or team" htmlFor="ask-groups" optional>
          <Input
            id="ask-groups"
            value={groupsOrTeam}
            onChange={(event) => setGroupsOrTeam(event.target.value)}
            placeholder="e.g. Analisi 2, IT"
            maxLength={200}
            autoComplete="off"
            aria-describedby={fieldHintId("ask-groups")}
            className={fieldControl}
          />
        </FormField>
        <FormField
          label="Telegram username"
          htmlFor="ask-telegram"
          optional
          hint="Helps HR match your request to your record."
          error={telegramError}
        >
          <Input
            id="ask-telegram"
            value={telegram}
            onChange={(event) => setTelegram(event.target.value)}
            placeholder="@username"
            maxLength={33}
            autoComplete="off"
            aria-invalid={telegramError ? true : undefined}
            aria-describedby={fieldHintId("ask-telegram")}
            className={cn(fieldControl, "font-mono")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}
