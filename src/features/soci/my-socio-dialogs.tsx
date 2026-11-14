import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import {
  DateField,
  FileButton,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  InlineAlert,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { todayIso } from "@/features/people/people-format"
import { errorMessage, useRefreshAfter } from "@/features/people/people-hooks"
import { cn } from "@/lib/utils"

import { codiceFiscaleProblem, matchesBirthDate, normalizeCodiceFiscale } from "./codice-fiscale"
import { birthDateFor } from "./codice-fiscale-birth"
import { formatEuro, MAX_RECEIPT_BYTES, parseEuro, RECEIPT_ACCEPT, RECEIPT_TYPES } from "./soci-fees"
import { completeMyDetails, uploadMyReceipt } from "./soci-self.functions"
import { completeDetailsInputSchema, type Me, SELF_FIELDS } from "./soci.contract"
import { type FieldErrors, fieldErrors } from "./socio-form"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

/** "5.00": the amount field's starting value. */
const amountText = (cents: number) => (cents / 100).toFixed(2)

function fileProblem(file: File | null) {
  if (!file) return "Choose the bank's receipt."
  if (!RECEIPT_TYPES.some((type) => type === file.type)) return "Upload a PDF, JPEG or PNG."
  if (file.size === 0) return "The file is empty."
  if (file.size > MAX_RECEIPT_BYTES) return "The file is larger than 10 MB."
  return undefined
}

/**
 * Upload transfer receipt: the bank's receipt (PDF, PNG or JPEG), the transfer date and the amount. It replaces a
 * receipt still waiting for review; the Direttivo then confirms or rejects it.
 */
export function UploadReceiptDialog({
  open,
  onOpenChange,
  payment,
  replacing,
}: DialogProps & { payment: Me["payment"]; replacing: boolean }) {
  const upload = useServerFn(uploadMyReceipt)
  const refresh = useRefreshAfter()
  const [file, setFile] = useState<File | null>(null)
  const [transferDate, setTransferDate] = useState(todayIso())
  const [amount, setAmount] = useState(amountText(payment.amountCents))
  const [submitted, setSubmitted] = useState(false)
  const today = todayIso()
  const cents = parseEuro(amount)
  const fileError = submitted ? fileProblem(file) : undefined
  const dateError = submitted
    ? !transferDate
      ? "Choose the day of the transfer."
      : transferDate > today
        ? "The transfer date is in the future."
        : undefined
    : undefined
  const amountError = submitted && cents === null ? "Enter the amount, e.g. 5.00." : undefined
  const otherAmount = cents !== null && cents !== payment.amountCents

  async function submit() {
    setSubmitted(true)
    if (fileProblem(file) || !file || !transferDate || transferDate > today || cents === null) return
    const form = new FormData()
    form.set("file", file)
    form.set("transferDate", transferDate)
    form.set("declaredCents", String(cents))
    try {
      await upload({ data: form })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't upload the receipt. Try again."), { cause: caught })
    }
    onOpenChange(false)
    await refresh("Receipt uploaded. The Direttivo reviews it and you'll get an email.")
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={replacing ? "Replace transfer receipt" : "Upload transfer receipt"}
      description={`Fee ${payment.label} · ${formatEuro(payment.amountCents)}`}
      noun="receipt"
      dirty={file !== null || transferDate !== today || amount !== amountText(payment.amountCents)}
      submitLabel="Upload receipt"
      onSubmit={submit}
    >
      {replacing ? <InlineAlert tone="neutral">It replaces the receipt waiting for review.</InlineAlert> : null}
      <FormField label="Bank's receipt" htmlFor="receipt-file" error={fileError}>
        <FileButton
          id="receipt-file"
          file={file}
          onChange={setFile}
          accept={RECEIPT_ACCEPT}
          hint="The PDF your bank gives for the transfer, or a screenshot: PDF, PNG or JPEG, up to 10 MB."
          invalid={!!fileError}
        />
      </FormField>
      <div className="grid gap-4 min-[480px]:grid-cols-2">
        <FormField label="Transfer date" htmlFor="receipt-date" error={dateError}>
          <DateField
            id="receipt-date"
            value={transferDate}
            onChange={setTransferDate}
            pastYears={1}
            futureYears={0}
            invalid={!!dateError}
            describedBy={dateError ? fieldHintId("receipt-date") : undefined}
          />
        </FormField>
        <FormField
          label="Amount (€)"
          htmlFor="receipt-amount"
          hint={otherAmount ? `The fee is ${formatEuro(payment.amountCents)}.` : undefined}
          error={amountError}
        >
          <Input
            id="receipt-amount"
            inputMode="decimal"
            value={amount}
            autoComplete="off"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError || otherAmount ? fieldHintId("receipt-amount") : undefined}
            onChange={(event) => setAmount(event.target.value)}
            className={cn("h-9 tabular-nums", fieldControl)}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

type SelfField = (typeof SELF_FIELDS)[number]

const LABELS = {
  codiceFiscale: "Codice fiscale",
  birthDate: "Birth date",
  birthPlace: "Birth place",
  residence: "Residence",
  phone: "Phone",
} satisfies Record<SelfField, string>

const HINTS = {
  codiceFiscale: null,
  birthDate: null,
  birthPlace: "The comune, or the city and country.",
  residence: "Street, number and comune on one line, e.g. Via Roma 1, Milano (MI).",
  phone: "International format, e.g. +39 333 123 4567.",
} satisfies Record<SelfField, string | null>

/**
 * Complete your details: the fields the register still lacks, which the association must keep. Only empty ones can be
 * filled in here; the Direttivo changes anything already recorded.
 */
export function CompleteDetailsDialog({ open, onOpenChange, me }: DialogProps & { me: Me }) {
  const complete = useServerFn(completeMyDetails)
  const refresh = useRefreshAfter()
  /** The empty fields, the phone included when it's empty, though it stays optional. */
  const fields = SELF_FIELDS.filter((key) => me.details[key] === null)
  const [draft, setDraft] = useState<Record<SelfField, string>>({
    codiceFiscale: "",
    birthDate: "",
    birthPlace: "",
    residence: "",
    phone: "",
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const code = normalizeCodiceFiscale(draft.codiceFiscale || me.details.codiceFiscale || "")
  const birthDate = draft.birthDate || me.details.birthDate || ""
  const dateMismatch = birthDate !== "" && !codiceFiscaleProblem(code) && !matchesBirthDate(code, birthDate)

  function set(key: SelfField, value: string) {
    // A valid code fills in the birth date it encodes, when that is empty too.
    if (key === "codiceFiscale" && fields.includes("birthDate"))
      setDraft({ ...draft, codiceFiscale: value, birthDate: birthDateFor(value, draft.birthDate, todayIso()) })
    else setDraft({ ...draft, [key]: value })
  }

  async function submit() {
    const parsed = completeDetailsInputSchema.safeParse(Object.fromEntries(fields.map((key) => [key, draft[key]])))
    setErrors(fieldErrors(parsed.error))
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path.length === 0)) throw new Error("Fill in at least one field.")
      return
    }
    if (dateMismatch) return
    try {
      await complete({ data: parsed.data })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't save your details. Check them and try again."), { cause: caught })
    }
    onOpenChange(false)
    await refresh("Details saved.")
  }

  const field = (key: SelfField) => {
    const id = `my-${key}`
    const error =
      errors[key] ??
      (key === "birthDate" && dateMismatch ? "The birth date doesn't match the codice fiscale." : undefined)
    return (
      <FormField
        key={key}
        label={LABELS[key]}
        htmlFor={id}
        optional={key === "phone"}
        hint={
          key === "birthDate" && fields.includes("codiceFiscale")
            ? "Filled in from the codice fiscale."
            : (HINTS[key] ?? undefined)
        }
        error={error}
      >
        {key === "birthDate" ? (
          <DateField
            id={id}
            value={draft.birthDate}
            onChange={(value) => set("birthDate", value)}
            pastYears={100}
            futureYears={0}
            invalid={!!error}
            describedBy={fieldHintId(id)}
          />
        ) : (
          <Input
            id={id}
            type={key === "phone" ? "tel" : undefined}
            inputMode={key === "phone" ? "tel" : undefined}
            value={draft[key]}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error || HINTS[key] ? fieldHintId(id) : undefined}
            onChange={(event) => set(key, event.target.value)}
            className={cn("h-9", key === "codiceFiscale" && "font-mono uppercase", fieldControl)}
          />
        )}
      </FormField>
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Complete your details"
      description="The association keeps them in the Libro Soci. Once saved, only the Direttivo can change them."
      noun="details"
      dirty={fields.some((key) => draft[key] !== "")}
      submitLabel="Save details"
      onSubmit={submit}
    >
      {fields.map(field)}
    </FormDialog>
  )
}
