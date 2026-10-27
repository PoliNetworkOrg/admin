import { useServerFn } from "@tanstack/react-start"
import { Bell, ExternalLink, FileText } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  Hint,
  InlineAlert,
  KeyValueList,
  SegmentedControl,
  Spinner,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PdfViewer, usePdfBytes } from "@/features/esign/pdf-viewer"
import { formatDateTime, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { centsToInput, formatCents, parseEuros } from "./people-fees"
import {
  approveFee,
  getFeeReview,
  getFeeUpload,
  markFeePaid,
  rejectFee,
  sendFeeReminders,
} from "./people-fees.functions"
import { fileBlob } from "./people-files"
import { FEE_STATUS, formatDay, PAYMENT_METHOD, REMINDER_SKIPPED, todayIso } from "./people-format"
import { errorMessage, useLoaded, useRefreshAfter } from "./people-hooks"
import { MonoChip, StateBadge } from "./people-ui"
import type { FilePayload, PaymentMethod } from "./people.contract"

/** Reasons offered as one-click starts for Reject; the admin can edit the text. */
const COMMON_REASONS = [
  {
    label: "Wrong amount",
    text: "The amount on the receipt isn't the fee. Transfer the rest and upload both receipts.",
  },
  {
    label: "Not a transfer receipt",
    text: "The file is a screenshot of the payment page, not the transfer receipt. Upload the receipt your bank issued.",
  },
  { label: "Unreadable file", text: "The file can't be read. Upload a clearer PDF or photo of the transfer receipt." },
]

export type FeeTarget = { id: string; name: string; number: string }

/** Loads the member's current fee year once per opening. */
function useFeeReview(personId: string) {
  const load = useServerFn(getFeeReview)
  const { data: review, failed } = useLoaded(useCallback(() => load({ data: { personId } }), [load, personId]))
  return { review, failed }
}

function Loading({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-[13px] text-(--pn-fg-muted)">
      <Spinner />
      {children}
    </p>
  )
}

const PREVIEW_LABEL = "The uploaded transfer receipt"

/** The uploaded transfer receipt: a PDF's pages or the image itself, with a link to open it in a new tab. */
function UploadPreview({ file, size }: { file: FilePayload | null; size: number }) {
  const pdfBytes = usePdfBytes(file?.contentType === "application/pdf" ? file.base64 : null)
  const blob = useMemo(() => (file ? fileBlob(file) : null), [file])
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  const image = file?.contentType.startsWith("image/") ?? false
  return (
    <figure className="m-0 flex flex-col overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken)">
      <figcaption className="flex h-11 items-center gap-2 border-b border-(--pn-line) bg-(--pn-surface) pr-1 pl-3 text-[13px]">
        <FileText aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-(--pn-fg-muted)" />
        {file ? (
          <Hint overflowOnly label={file.fileName}>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{file.fileName}</span>
          </Hint>
        ) : (
          <span className="min-w-0 flex-1 text-(--pn-fg-muted)">Loading…</span>
        )}
        <span className="text-xs text-(--pn-fg-muted) tabular-nums">{Math.max(1, Math.round(size / 1024))} KB</span>
        {url ? (
          <Button
            size="sm"
            variant="ghost"
            className={buttonMotion}
            nativeButton={false}
            render={<a href={url} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink data-icon="inline-start" />
            Open
          </Button>
        ) : null}
      </figcaption>
      {blob && url && image ? (
        <img src={url} alt={PREVIEW_LABEL} className="max-h-80 w-full object-contain" />
      ) : blob && !image ? (
        <PdfViewer data={pdfBytes} compact />
      ) : (
        <div className="grid h-80 place-items-center">
          <Loading>Loading the file…</Loading>
        </div>
      )}
    </figure>
  )
}

/**
 * Review receipt: the member's uploaded transfer receipt next to their fee year. Approve marks the fee Paid and issues
 * the next receipt to sign; Reject asks for a reason the member reads in My area and in the email.
 */
export function ReviewReceiptDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: FeeTarget
}) {
  const { review, failed } = useFeeReview(person.id)
  const loadFile = useServerFn(getFeeUpload)
  const { data: file, failed: fileFailed } = useLoaded(
    useCallback(() => loadFile({ data: { personId: person.id } }), [loadFile, person.id])
  )
  const approve = useServerFn(approveFee)
  const reject = useServerFn(rejectFee)
  const refresh = useRefreshAfter()
  const [mode, setMode] = useState<"review" | "reject">("review")
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const firstName = person.name.split(" ")[0] ?? person.name

  const upload = review?.fee.upload ?? null
  const reasonError = submitted && !reason.trim() ? "Say why, so the member knows what to fix." : undefined

  async function submit() {
    if (!review || !upload) return
    if (mode === "review") {
      let issued: string
      try {
        issued = (await approve({ data: { personId: person.id } })).receipt
      } catch (caught) {
        console.error(caught)
        throw new Error(errorMessage(caught, "Couldn't approve the receipt. Try again."), { cause: caught })
      }
      await refresh(`Fee marked as paid. Receipt ${issued} is ready to sign.`)
      onOpenChange(false)
      return
    }
    setSubmitted(true)
    if (!reason.trim()) return
    try {
      await reject({ data: { personId: person.id, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't reject the receipt. Try again."), { cause: caught })
    }
    await refresh(`Transfer receipt rejected. ${firstName} can upload a new one.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Review receipt"
      description={
        <>
          {person.name} · <span className="font-mono">{review?.fee.year ?? ""}</span>
        </>
      }
      noun="review"
      dirty={reason.trim() !== ""}
      submitLabel={mode === "review" ? "Approve" : "Reject receipt"}
      tone={mode === "review" ? undefined : "danger"}
      canSubmit={review !== null && upload !== null}
      onSubmit={submit}
      footerStart={
        review && upload ? (
          mode === "review" ? (
            <Button
              type="button"
              variant="outline"
              className={cn(buttonMotion, "h-10 text-(--pn-danger-fg)")}
              onClick={() => setMode("reject")}
            >
              Reject
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={cn(buttonMotion, "h-10")}
              onClick={() => {
                setMode("review")
                setSubmitted(false)
              }}
            >
              Back
            </Button>
          )
        ) : undefined
      }
      notice={
        review && upload && mode === "review" ? (
          <InlineAlert tone="info">
            Approving marks the fee Paid and issues receipt <span className="font-mono">{review.nextReceipt}</span> for
            signing.
          </InlineAlert>
        ) : undefined
      }
    >
      {failed ? <InlineAlert>Couldn't load the fee. Close and try again.</InlineAlert> : null}
      {!review && !failed ? <Loading>Loading the receipt…</Loading> : null}
      {review && !upload ? (
        <InlineAlert tone="neutral">
          There is no transfer receipt to review: someone may have just handled it.
        </InlineAlert>
      ) : null}
      {review && upload ? (
        <div className="flex flex-col gap-4">
          {fileFailed ? (
            <InlineAlert>Couldn't load the file. The details below come from the upload.</InlineAlert>
          ) : (
            <UploadPreview file={file} size={upload.size} />
          )}
          {upload.amountCents !== review.fee.amountCents ? (
            <InlineAlert tone="warning">
              The declared amount is {formatCents(upload.amountCents)}, but the fee is{" "}
              {formatCents(review.fee.amountCents)}.
            </InlineAlert>
          ) : null}
          <KeyValueList
            items={[
              {
                key: "Member",
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    {review.person.name} <MonoChip>{review.memberNumber}</MonoChip>
                  </span>
                ),
              },
              {
                key: "Microsoft 365",
                value: <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{review.m365Email}</span>,
              },
              {
                key: `Fee ${review.fee.year}`,
                value: <StateBadge state={FEE_STATUS[review.fee.status]} />,
              },
              { key: "Amount due", value: <span className="tabular-nums">{formatCents(review.fee.amountCents)}</span> },
              {
                key: "Transfer",
                value: (
                  <span className="tabular-nums">
                    {formatCents(upload.amountCents)} on {formatDay(upload.transferDate)}{" "}
                    <span className="text-xs text-(--pn-fg-muted)">as declared</span>
                  </span>
                ),
              },
              { key: "Uploaded", value: formatDateTime(new Date(upload.uploadedAt)) },
              {
                key: "Earlier rejections",
                value: review.rejections.length ? (
                  <span className="flex flex-col gap-1">
                    {review.rejections.map((rejection) => (
                      <span key={rejection.at} className="text-[13px]">
                        {formatDay(rejection.at.slice(0, 10))}: “{rejection.reason}”
                      </span>
                    ))}
                  </span>
                ) : null,
              },
            ]}
          />
          {mode === "reject" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-[14px] font-medium">Common reasons</span>
                <div className="flex flex-wrap gap-2">
                  {COMMON_REASONS.map((option) => (
                    <Button
                      key={option.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={reason === option.text}
                      className={cn(
                        buttonMotion,
                        reason === option.text &&
                          "border-[color-mix(in_oklab,var(--pn-accent)_45%,transparent)] bg-(--pn-accent-soft) text-(--pn-accent)"
                      )}
                      onClick={() => setReason(option.text)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
              <FormField
                label="Reason"
                htmlFor="review-reason"
                hint={`${firstName} reads this in My area and in the email, then uploads a new receipt.`}
                error={reasonError}
              >
                <Textarea
                  id="review-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  autoFocus
                  aria-invalid={reasonError ? true : undefined}
                  aria-describedby={fieldHintId("review-reason")}
                  className={cn(fieldControl, "min-h-24")}
                />
              </FormField>
            </div>
          ) : null}
        </div>
      ) : null}
    </FormDialog>
  )
}

/** A fee paid without an uploaded receipt (cash at an event, or a transfer seen on the statement). */
export function MarkPaidDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: FeeTarget
}) {
  const { review, failed } = useFeeReview(person.id)
  const save = useServerFn(markFeePaid)
  const refresh = useRefreshAfter()
  const [paidOn, setPaidOn] = useState(todayIso())
  const [amount, setAmount] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>("transfer")
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const amountText = amount ?? (review ? centsToInput(review.fee.amountCents) : "")
  const cents = parseEuros(amountText)
  const amountError = submitted && cents === null ? "Enter the amount, such as 10.00." : undefined
  const dateError = submitted && !paidOn ? "Choose the payment date." : undefined

  async function submit() {
    setSubmitted(true)
    if (!review || cents === null || !paidOn) return
    let issued: string
    try {
      issued = (await save({ data: { personId: person.id, paidOn, amountCents: cents, method, note: note.trim() } }))
        .receipt
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't mark the fee as paid. Try again."), { cause: caught })
    }
    await refresh(`Fee marked as paid. Receipt ${issued} is ready to sign.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mark as paid"
      description="For a fee paid without an uploaded receipt, such as cash at an event. A receipt is issued for signing."
      noun="payment"
      dirty={note.trim() !== "" || amount !== null || method !== "transfer" || paidOn !== todayIso()}
      submitLabel="Mark as paid"
      canSubmit={review !== null}
      onSubmit={submit}
      notice={
        review ? (
          <InlineAlert tone="info">
            Issues receipt <span className="font-mono">{review.nextReceipt}</span> for the President to sign.
          </InlineAlert>
        ) : undefined
      }
    >
      {failed ? <InlineAlert>Couldn't load the fee. Close and try again.</InlineAlert> : null}
      {!review && !failed ? <Loading>Loading the fee…</Loading> : null}
      {review ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{person.name}</span>
              <span className="text-xs text-(--pn-fg-muted)">
                <span className="font-mono">{person.number}</span> · Fee{" "}
                <span className="font-mono">{review.fee.year}</span>
              </span>
            </span>
            <StateBadge state={FEE_STATUS[review.fee.status]} />
          </div>
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <FormField label="Payment date" htmlFor="paid-on" error={dateError}>
              <DateField
                id="paid-on"
                value={paidOn}
                onChange={setPaidOn}
                invalid={!!dateError}
                describedBy={dateError ? fieldHintId("paid-on") : undefined}
              />
            </FormField>
            <FormField
              label="Amount"
              htmlFor="paid-amount"
              hint={`The ${review.fee.year} fee is ${formatCents(review.fee.amountCents)}.`}
              error={amountError}
            >
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-(--pn-fg-muted)"
                >
                  €
                </span>
                <Input
                  id="paid-amount"
                  value={amountText}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-invalid={amountError ? true : undefined}
                  aria-describedby={fieldHintId("paid-amount")}
                  className={cn(fieldControl, "pl-7 tabular-nums")}
                />
              </div>
            </FormField>
          </div>
          <FormField label="Method" htmlFor="paid-method">
            <SegmentedControl<PaymentMethod>
              id="paid-method"
              label="Method"
              items={[
                { value: "transfer", label: PAYMENT_METHOD.transfer },
                { value: "cash", label: PAYMENT_METHOD.cash },
              ]}
              value={method}
              onValueChange={setMethod}
              className="w-full [&>*]:flex-1"
            />
          </FormField>
          <FormField
            label="Note"
            htmlFor="paid-note"
            optional
            hint="Kept in the record's activity, not printed on the receipt."
          >
            <Textarea
              id="paid-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              aria-describedby={fieldHintId("paid-note")}
              className={cn(fieldControl, "min-h-20")}
            />
          </FormField>
        </div>
      ) : null}
    </FormDialog>
  )
}

/** Confirms the page's Send reminders: every Due and Unpaid fee, except members reminded in the last 3 days. */
export function SendFeeRemindersDialog({
  open,
  onOpenChange,
  count,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Members with a Due or Unpaid fee. */
  count: number
}) {
  const remind = useServerFn(sendFeeReminders)
  const refresh = useRefreshAfter()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="primary"
      icon={Bell}
      title="Send reminders?"
      description={`${pluralize(count, "member")} with a Due or Unpaid fee get an email with a link to My area. Members reminded in the last 3 days are skipped.`}
      confirmLabel="Send reminders"
      onConfirm={async () => {
        const result = await remind({ data: { personId: null } })
        await refresh(
          `${pluralize(result.sent, "reminder")} sent${result.skipped ? `, ${result.skipped} not sent` : ""}.`,
          result.skipped ? "warning" : "success"
        )
      }}
    />
  )
}

/** Send reminder on one row or record: no confirmation, as it only sends an email. */
export function useSendFeeReminder() {
  const remind = useServerFn(sendFeeReminders)
  const refresh = useRefreshAfter()
  return async (person: { id: string; name: string }) => {
    let sent: boolean
    try {
      sent = (await remind({ data: { personId: person.id } })).sent > 0
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, `Couldn't send the reminder to ${person.name}.`))
      return
    }
    await (sent
      ? refresh(`Reminder sent to ${person.name}.`)
      : refresh(`No reminder sent to ${person.name}: ${REMINDER_SKIPPED}.`, "warning"))
  }
}
