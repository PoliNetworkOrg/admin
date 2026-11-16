import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Ban } from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  DateField,
  dialogFooter,
  dialogFooterButton,
  fieldControl,
  fieldHintId,
  FieldCounter,
  FormDialog,
  FormField,
  InlineAlert,
  KeyValueList,
  SegmentedControl,
  SelectField,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDay, todayIso } from "@/features/people/people-format"
import { errorMessage, useRefreshAfter } from "@/features/people/people-hooks"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { amountMismatch, ReceiptPreview } from "./fee-ui"
import { feeYearLabel, feeYearOf, formatEuro, pastDeadline, renewalDeadline } from "./soci-fees"
import { formatMemberNumber, socioName } from "./soci-format"
import { confirmFee, markFeePaid, rejectFee } from "./soci-write.functions"
import type { Fee } from "./soci.contract"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

/** Who a fee belongs to, as the Fees list and the socio page both have it. */
export type FeeSocio = { number: number; firstName: string; lastName: string; mailbox: string }

const REASON_MAX = 500

/** One-click starts for the rejection reason, which the socio reads in the email and in My area. */
const REASON_STARTS = [
  "The amount doesn't match the fee.",
  "The payment reference is missing.",
  "The file isn't readable: upload the bank's PDF receipt.",
] as const

/**
 * Review: the uploaded receipt, the declared transfer and the last rejection, then Confirm, or Reject with a required
 * reason. Reject switches the dialog to the reason (danger, Back on the left). After the renewal deadline, rejecting
 * warns that the socio lapses at the next daily run unless they pay.
 */
export function ReviewFeeDialog({ open, onOpenChange, socio, fee }: DialogProps & { socio: FeeSocio; fee: Fee }) {
  const confirm = useServerFn(confirmFee)
  const reject = useServerFn(rejectFee)
  const refresh = useRefreshAfter()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const upload = fee.upload
  const name = socioName(socio)
  const late = pastDeadline(fee.year, todayIso())
  const reasonError = submitted && !reason.trim() ? "Say why, so the socio can fix it." : undefined

  async function submit() {
    if (!upload) return
    const ref = { number: socio.number, year: fee.year, fileId: upload.fileId }
    if (!rejecting) {
      try {
        await confirm({ data: ref })
      } catch (caught) {
        console.error(caught)
        throw new Error(errorMessage(caught, "Couldn't confirm the receipt. Try again."), { cause: caught })
      }
      await refresh(`${name}'s ${fee.label} fee is paid.`)
      onOpenChange(false)
      return
    }
    setSubmitted(true)
    if (!reason.trim()) return
    try {
      await reject({ data: { ...ref, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't reject the receipt. Try again."), { cause: caught })
    }
    await refresh(`Receipt rejected. ${name} gets the reason by email.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={rejecting ? "Reject receipt" : "Review receipt"}
      description={`${formatMemberNumber(socio.number)} · ${name} · fee ${fee.label}`}
      noun="review"
      dirty={reason.trim() !== ""}
      tone={rejecting ? "danger" : undefined}
      icon={rejecting ? Ban : undefined}
      submitLabel={rejecting ? "Reject receipt" : "Confirm payment"}
      canSubmit={!!upload}
      onSubmit={submit}
      footerStart={
        rejecting ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(buttonMotion, "h-10")}
            onClick={() => {
              setRejecting(false)
              setSubmitted(false)
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className={cn(buttonMotion, "h-10 text-(--pn-danger-fg)")}
            disabled={!upload}
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        )
      }
      notice={
        rejecting && late ? (
          <InlineAlert tone="warning">
            The renewal deadline, {formatDay(renewalDeadline(fee.year))}, has passed: once rejected, the fee is Due
            again and {name} lapses at the next daily run unless it's paid.
          </InlineAlert>
        ) : undefined
      }
    >
      {!upload ? (
        <InlineAlert tone="neutral">There's no receipt to review for this fee.</InlineAlert>
      ) : rejecting ? (
        <div className="flex flex-col gap-3">
          <FormField
            label="Reason"
            htmlFor="fee-reject-reason"
            hint="The socio reads it in the email and in My area, and uploads a new receipt."
            error={reasonError}
          >
            <Textarea
              id="fee-reject-reason"
              value={reason}
              maxLength={REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={fieldHintId("fee-reject-reason")}
              className={cn(fieldControl, "min-h-24")}
            />
          </FormField>
          <div className="flex flex-wrap items-center gap-2">
            {REASON_STARTS.map((start) => (
              <Button
                key={start}
                type="button"
                size="sm"
                variant="outline"
                className={cn(buttonMotion, "h-auto min-h-9 py-1.5 text-left whitespace-normal")}
                onClick={() => setReason(start)}
              >
                {start}
              </Button>
            ))}
            <FieldCounter length={reason.length} max={REASON_MAX} className="ml-auto" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ReceiptPreview fileId={upload.fileId} fileName={upload.fileName} />
          <KeyValueList
            items={[
              { key: "Transfer date", value: formatDay(upload.transferDate) },
              {
                key: "Declared amount",
                value: <span className="tabular-nums">{formatEuro(upload.declaredCents)}</span>,
                hint: amountMismatch(fee) ? `The fee is ${formatEuro(fee.amountCents)}.` : undefined,
              },
              { key: "File", value: <span className="[overflow-wrap:anywhere]">{upload.fileName}</span> },
              { key: "Uploaded", value: formatDateTime(new Date(upload.uploadedAt)) },
            ]}
          />
          {fee.lastRejection ? (
            <InlineAlert tone="neutral">
              An earlier receipt was rejected on {formatDay(fee.lastRejection.at)}: {fee.lastRejection.reason}
            </InlineAlert>
          ) : null}
          {amountMismatch(fee) ? (
            <InlineAlert tone="warning">
              The socio declared {formatEuro(upload.declaredCents)}, not {formatEuro(fee.amountCents)}: check the amount
              on the receipt.
            </InlineAlert>
          ) : null}
        </div>
      )}
    </FormDialog>
  )
}

const METHODS = [
  { value: "transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const

type Method = (typeof METHODS)[number]["value"]

/**
 * Mark as paid: a payment made outside the dashboard, with its date, method and an optional note. `years` are the fee
 * years it may record, newest first; with one, the dialog names it instead of asking. They are read when the dialog
 * opens, so the reload after saving doesn't change it while it closes.
 */
export function MarkPaidDialog({
  open,
  onOpenChange,
  socio,
  years: yearsOnOpen,
  fee,
  fees,
}: DialogProps & {
  socio: FeeSocio
  years: readonly number[]
  /** The fee being paid, when there is one: a receipt waiting for review gives the default payment date. */
  fee?: Fee | null
  /** The socio's fees, to name the amount of the year chosen when `fee` isn't given. */
  fees?: readonly Fee[]
}) {
  const markPaid = useServerFn(markFeePaid)
  const refresh = useRefreshAfter()
  const [years] = useState(yearsOnOpen)
  const [year, setYear] = useState<number | null>(years.length === 1 ? (years[0] ?? null) : null)
  const [paidOn, setPaidOn] = useState((fee?.status === "uploaded" ? fee.upload?.transferDate : null) ?? todayIso())
  const [method, setMethod] = useState<Method>("transfer")
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const name = socioName(socio)
  const today = todayIso()
  const amountCents = (fee ?? fees?.find((candidate) => candidate.year === year))?.amountCents
  const yearError = submitted && year === null ? "Choose the fee year." : undefined
  const dateError = submitted
    ? !paidOn
      ? "Choose the payment date."
      : paidOn > today
        ? "The payment date is in the future."
        : undefined
    : undefined
  const noteError = submitted && method === "other" && !note.trim() ? "Say how it was paid." : undefined

  async function submit() {
    setSubmitted(true)
    if (year === null || !paidOn || paidOn > today || (method === "other" && !note.trim())) return
    try {
      await markPaid({ data: { number: socio.number, year, paidOn, method, note: note.trim() || null } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't mark the fee as paid. Try again."), { cause: caught })
    }
    await refresh(`${name}'s ${feeYearLabel(year)} fee is paid.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mark as paid"
      description={`${formatMemberNumber(socio.number)} · ${name}${years.length === 1 && year !== null ? ` · fee ${feeYearLabel(year)}` : ""}`}
      noun="payment"
      dirty={note.trim() !== "" || method !== "transfer" || (years.length > 1 && year !== null)}
      submitLabel="Mark as paid"
      onSubmit={submit}
    >
      {years.length > 1 ? (
        <FormField label="Fee year" htmlFor="fee-paid-year" error={yearError}>
          <SelectField
            id="fee-paid-year"
            value={year === null ? null : String(year)}
            options={years.map((value) => ({ value: String(value), label: feeYearLabel(value) }))}
            onChange={(value) => setYear(Number(value))}
            placeholder="Choose a fee year"
            invalid={!!yearError}
          />
        </FormField>
      ) : null}
      <FormField label="Paid on" htmlFor="fee-paid-on" error={dateError}>
        <DateField
          id="fee-paid-on"
          value={paidOn}
          onChange={setPaidOn}
          pastYears={10}
          futureYears={0}
          invalid={!!dateError}
          describedBy={dateError ? fieldHintId("fee-paid-on") : undefined}
        />
      </FormField>
      <FormField label="Method" htmlFor="fee-paid-method">
        <SegmentedControl<Method>
          id="fee-paid-method"
          label="Method"
          items={METHODS}
          value={method}
          onValueChange={setMethod}
          className="self-start"
        />
      </FormField>
      <FormField
        label="Note"
        htmlFor="fee-paid-note"
        optional={method !== "other"}
        hint={method === "other" ? "How it was paid, e.g. cash at the assembly." : "Saved with the payment."}
        error={noteError}
      >
        <Textarea
          id="fee-paid-note"
          value={note}
          maxLength={REASON_MAX}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={noteError ? true : undefined}
          aria-describedby={fieldHintId("fee-paid-note")}
          className={cn(fieldControl, "min-h-20")}
        />
      </FormField>
      <p className="text-[13px] text-(--pn-fg-muted)">
        {name} gets an email that the fee is paid.
        {amountCents === undefined ? null : <> Amount: {formatEuro(amountCents)}.</>}
      </p>
    </FormDialog>
  )
}

/**
 * The fee years Mark as paid may record for a socio: from the admission's to this one, those not yet paid or exempt.
 * A year with no fee yet is opened as paid, except the summer admission's exempt one, which the daily job opens.
 */
export function payableYears(
  socio: { admittedOn: string; endedOn: string | null },
  fees: readonly Fee[],
  today: string
) {
  const current = feeYearOf(today)
  const last = socio.endedOn ? Math.min(feeYearOf(socio.endedOn), current) : current
  const [admittedYear = 0, month = 0] = socio.admittedOn.split("-").map(Number)
  const exempt = month >= 6 && month <= 8 ? admittedYear : null
  const years: number[] = []
  for (let year = last; year >= feeYearOf(socio.admittedOn); year--) {
    const fee = fees.find((candidate) => candidate.year === year)
    if (fee ? fee.status === "due" || fee.status === "uploaded" : year !== exempt) years.push(year)
  }
  return years
}

/** An uploaded receipt, read-only: a paid fee's, or one that was rejected. */
export function ReceiptDialog({ open, onOpenChange, socio, fee }: DialogProps & { socio: FeeSocio; fee: Fee }) {
  const upload = fee.upload
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Transfer receipt"
      description={`${formatMemberNumber(socio.number)} · ${socioName(socio)} · fee ${fee.label}`}
      noun="receipt"
      dirty={false}
      onSubmit={() => onOpenChange(false)}
      footer={
        <div className={dialogFooter}>
          <Button type="button" variant="outline" className={dialogFooterButton} onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      }
    >
      {upload ? (
        <>
          <ReceiptPreview fileId={upload.fileId} fileName={upload.fileName} />
          <KeyValueList
            items={[
              { key: "Transfer date", value: formatDay(upload.transferDate) },
              {
                key: "Declared amount",
                value: <span className="tabular-nums">{formatEuro(upload.declaredCents)}</span>,
              },
              { key: "Uploaded", value: formatDateTime(new Date(upload.uploadedAt)) },
              ...(fee.status === "due" && fee.lastRejection
                ? [{ key: "Rejected", value: `${formatDay(fee.lastRejection.at)}: ${fee.lastRejection.reason}` }]
                : []),
            ]}
          />
        </>
      ) : (
        <InlineAlert tone="neutral">No receipt was uploaded for this fee.</InlineAlert>
      )}
    </FormDialog>
  )
}
