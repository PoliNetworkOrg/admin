import { useServerFn } from "@tanstack/react-start"
import { FileDown, FileText, Hourglass, Upload } from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  CopyableText,
  DateField,
  fieldControl,
  fieldHintId,
  FileButton,
  FormDialog,
  FormField,
  InlineAlert,
  KeyValueList,
  LoadingButton,
  SectionCard,
  StatusBadge,
  useOpenGeneration,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { centsToInput, formatCents, parseEuros } from "./people-fees"
import { FEE_STATUS, formatDay, todayIso } from "./people-format"
import { errorMessage, useFileDownload, useRefreshAfter } from "./people-hooks"
import { downloadMyReceipt, uploadMyTransferReceipt } from "./people-self.functions"
import { Row, RowIcon, Rows, StateBadge, SubHeading } from "./people-ui"
import type { FeeDetail, FeeInstructions, Fees } from "./people.contract"

const TRANSFER_TYPES = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"

/**
 * My area's fee card: how to pay and the upload while the fee is due, the review while a receipt is uploaded, the
 * receipt being signed once paid, and every signed receipt to download.
 */
export function MyFeeCard({ fees, instructions }: { fees: Fees; instructions: FeeInstructions | null }) {
  const download = useServerFn(downloadMyReceipt)
  const [uploadOpen, setUploadOpen] = useState(false)
  const uploadKey = useOpenGeneration(uploadOpen)
  const { busy, download: downloadFile } = useFileDownload()
  const fee = fees.current
  // Voided receipts were replaced by another; one still to sign shows as Being signed.
  const receipts = fees.receipts.filter((receipt) => receipt.status !== "voided")
  const signing = fee ? receipts.find((receipt) => receipt.year === fee.year && receipt.status === "toSign") : undefined
  const owing = fee?.status === "due" || fee?.status === "unpaid"

  function openUpload() {
    setUploadOpen(true)
  }

  return (
    <SectionCard
      title={fee ? `Membership fee ${fee.year}` : "Membership fees"}
      action={fee ? <StateBadge state={FEE_STATUS[fee.status]} /> : undefined}
      padding="flush"
    >
      {fee ? (
        <div className="flex flex-col gap-4 border-b border-(--pn-line) p-4">
          {owing && fee.rejection ? (
            <InlineAlert>
              <span className="font-medium">Your transfer receipt was rejected</span> on{" "}
              {formatDay(fee.rejection.at.slice(0, 10))}: “{fee.rejection.reason}”
            </InlineAlert>
          ) : null}
          {owing && instructions ? (
            <>
              <p className="text-[14px] text-pretty">
                {fee.status === "unpaid" ? `The deadline was ${formatDay(fee.dueOn)}. ` : ""}Pay{" "}
                <span className="font-medium tabular-nums">{formatCents(fee.amountCents)}</span> by bank transfer
                {fee.status === "due" ? ` by ${formatDay(fee.dueOn)}` : ""}, then upload the bank’s transfer receipt.
              </p>
              <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) px-3.5 py-3">
                <KeyValueList
                  items={[
                    { key: "Beneficiary", value: <CopyableText value={instructions.beneficiary} what="Beneficiary" /> },
                    {
                      key: "IBAN",
                      value: <CopyableText value={instructions.iban} what="IBAN" className="font-mono text-[13px]" />,
                    },
                    { key: "Amount", value: <span className="tabular-nums">{formatCents(fee.amountCents)}</span> },
                    {
                      key: "Reference",
                      value: (
                        <CopyableText
                          value={instructions.reference}
                          what="Reference"
                          className="font-mono text-[13px]"
                        />
                      ),
                    },
                  ]}
                />
              </div>
              <div>
                <Button className={cn(buttonMotion, "h-10 max-shell:w-full")} onClick={openUpload}>
                  <Upload data-icon="inline-start" />
                  {fee.rejection ? "Upload a new receipt" : "Upload transfer receipt"}
                </Button>
              </div>
            </>
          ) : null}
          {fee.status === "receipt" && fee.upload ? (
            <>
              <div className="flex items-center gap-3 rounded-(--pn-r-4) border border-(--pn-line) px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-(--pn-r-3) bg-(--pn-muted) text-(--pn-fg-muted)">
                  <FileText aria-hidden strokeWidth={1.75} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px]">{fee.upload.fileName}</span>
                  <span className="text-xs text-(--pn-fg-muted)">
                    Uploaded {formatDateTime(new Date(fee.upload.uploadedAt))} · transfer of{" "}
                    {formatDay(fee.upload.transferDate)}
                  </span>
                </span>
              </div>
              <p className="text-[14px] text-(--pn-fg-muted)">Your transfer receipt is awaiting review.</p>
            </>
          ) : null}
          {fee.status === "paid" ? (
            <InlineAlert tone="neutral">
              {fee.payment ? `Paid on ${formatDay(fee.payment.paidOn)}. ` : "Paid. "}
              {signing ? (
                <>
                  Receipt <span className="font-mono">{signing.number}</span> is waiting for a signature; it reaches you
                  by email once signed.
                </>
              ) : (
                "Your receipt is below."
              )}
            </InlineAlert>
          ) : null}
        </div>
      ) : null}
      <Rows>
        <SubHeading>Your receipts</SubHeading>
        {receipts.length === 0 ? (
          <li className="px-4 pb-3 text-[13px] text-(--pn-fg-muted)">None yet. Each paid fee gets a signed receipt.</li>
        ) : null}
        {receipts.map((receipt) => (
          <Row
            key={receipt.id}
            lead={<RowIcon icon={FileText} />}
            title={
              <>
                <span className="font-mono">{receipt.number}</span>
                <span className="text-[13px] font-normal text-(--pn-fg-muted)">
                  Fee <span className="font-mono">{receipt.year}</span>
                </span>
              </>
            }
            meta={
              receipt.status === "toSign" || !receipt.signedOn
                ? `Issued ${formatDay(receipt.issuedOn)}`
                : `Signed ${formatDay(receipt.signedOn)}`
            }
            end={
              receipt.status === "toSign" ? (
                <StatusBadge tone="neutral">
                  <Hourglass aria-hidden className="size-3" />
                  Being signed
                </StatusBadge>
              ) : (
                <LoadingButton
                  size="sm"
                  variant="outline"
                  icon={FileDown}
                  pending={busy === receipt.id}
                  aria-label={`Download receipt ${receipt.number}`}
                  onClick={() =>
                    void downloadFile(
                      receipt.id,
                      () => download({ data: { receiptId: receipt.id } }),
                      `Couldn't download receipt ${receipt.number}.`
                    )
                  }
                >
                  PDF
                </LoadingButton>
              )
            }
          />
        ))}
      </Rows>
      {fee && owing ? (
        <UploadTransferDialog key={`upload-${uploadKey}`} open={uploadOpen} onOpenChange={setUploadOpen} fee={fee} />
      ) : null}
    </SectionCard>
  )
}

/** The member's bank receipt for the fee, with the transfer date and amount as written on it. */
function UploadTransferDialog({
  open,
  onOpenChange,
  fee,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fee: FeeDetail
}) {
  const upload = useServerFn(uploadMyTransferReceipt)
  const refresh = useRefreshAfter()
  const [file, setFile] = useState<File | null>(null)
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState(centsToInput(fee.amountCents))
  const [submitted, setSubmitted] = useState(false)
  const cents = parseEuros(amount)
  const fileError = submitted && !file ? "Choose the transfer receipt." : undefined
  const dateError = submitted && !date ? "Choose the transfer date." : undefined
  const amountError = submitted && cents === null ? "Enter the amount, such as 10.00." : undefined

  async function submit() {
    setSubmitted(true)
    if (!file || !date || cents === null) return
    const form = new FormData()
    form.set("file", file)
    form.set("transferDate", date)
    form.set("amountCents", String(cents))
    try {
      await upload({ data: form })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't upload the receipt. Try again."), { cause: caught })
    }
    await refresh("Transfer receipt uploaded.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload transfer receipt"
      description={`The receipt your bank issued for the ${formatCents(fee.amountCents)} transfer. An admin checks it, then the fee turns Paid.`}
      noun="upload"
      dirty={file !== null}
      submitLabel="Upload receipt"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <FormField label="File" htmlFor="transfer-file" error={fileError}>
          <FileButton
            id="transfer-file"
            file={file}
            onChange={setFile}
            accept={TRANSFER_TYPES}
            hint="PDF, JPG or PNG, up to 10 MB. A screenshot of the payment page isn't enough."
            invalid={!!fileError}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
          <FormField label="Transfer date" htmlFor="transfer-date" error={dateError}>
            <DateField
              id="transfer-date"
              value={date}
              onChange={setDate}
              invalid={!!dateError}
              describedBy={dateError ? fieldHintId("transfer-date") : undefined}
            />
          </FormField>
          <FormField label="Amount" htmlFor="transfer-amount" hint="As written on the receipt." error={amountError}>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-(--pn-fg-muted)"
              >
                €
              </span>
              <Input
                id="transfer-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={amountError ? true : undefined}
                aria-describedby={fieldHintId("transfer-amount")}
                className={cn(fieldControl, "pl-7 tabular-nums")}
              />
            </div>
          </FormField>
        </div>
      </div>
    </FormDialog>
  )
}
