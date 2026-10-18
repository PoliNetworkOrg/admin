import { useServerFn } from "@tanstack/react-start"
import { FileText, X } from "lucide-react"
import { useId, useState } from "react"

import {
  fieldControl,
  fieldHintId,
  FilePickerButton,
  FormDialog,
  FormField,
  Hint,
  IconButton,
  InlineAlert,
  SelectField,
  StatusBadge,
  type StatusTone,
} from "@/components/primitives"
import { Textarea } from "@/components/ui/textarea"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { type SignedFileOutcome, signedFileOutcome } from "./people-fees"
import { voidReceipt } from "./people-fees.functions"
import { currentYear, SIGNER_LABEL } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { previewSignedReceipts, sendSignedReceipts } from "./people-receipts.functions"
import type { Receipt, ReceiptsPage, SignedUpload } from "./people.contract"

const OUTCOME = {
  ready: { label: "Signed", tone: "success" },
  notSigned: { label: "Not signed", tone: "danger" },
  otherSigner: { label: "Needs another signer", tone: "warning" },
  noReceipt: { label: "No receipt", tone: "neutral" },
  notToSign: { label: "Already signed", tone: "neutral" },
  duplicate: { label: "Duplicate", tone: "neutral" },
} satisfies Record<SignedFileOutcome, { label: string; tone: StatusTone }>

function outcomeNote(outcome: SignedFileOutcome, receipt: Receipt | null, page: ReceiptsPage) {
  if (outcome === "notSigned") return "No digital signature found. Sign it with the CIE app and add it again."
  if (outcome === "noReceipt") return "No receipt number in the name. Pick the receipt this file belongs to."
  if (outcome === "duplicate") return "Another file is matched to the same receipt."
  if (outcome === "notToSign") return "This receipt isn't waiting for a signature."
  if (outcome === "otherSigner" && receipt) {
    const officer = receipt.signer === "president" ? page.officers.president : page.officers.vicePresident
    const own = receipt.person.id === page.officers.president?.id
    const office = `the ${SIGNER_LABEL[receipt.signer]}`
    return `${own ? "Your own receipt: " : ""}${officer ? `${officer.name}, ${office},` : office} signs it.`
  }
  return null
}

/**
 * Upload signed receipts: the backend reads the files and matches each by the receipt number in its name; the
 * signer checks the matches, corrects any by hand and sends the ones that are signed and theirs to sign.
 */
export function UploadSignedDialog({
  open,
  onOpenChange,
  page,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: ReceiptsPage
}) {
  const preview = useServerFn(previewSignedReceipts)
  const send = useServerFn(sendSignedReceipts)
  const refresh = useRefreshAfter()
  const inputId = useId()
  const [upload, setUpload] = useState<SignedUpload | null>(null)
  const [assigned, setAssigned] = useState<Record<string, string | null>>({})
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)

  const byId = new Map(page.receipts.map((receipt) => [receipt.id, receipt]))
  const choices = page.receipts
    .filter((receipt) => receipt.status === "toSign")
    .map((receipt) => ({ value: receipt.id, label: `${receipt.number} · ${receipt.person.name}` }))

  const rows = (upload?.files ?? []).map((file, index, files) => {
    const receiptId = assigned[file.fileId] ?? null
    const receipt = receiptId ? (byId.get(receiptId) ?? null) : null
    const duplicate =
      receiptId !== null && files.slice(0, index).some((other) => (assigned[other.fileId] ?? null) === receiptId)
    const outcome = signedFileOutcome({
      signed: file.signature.valid,
      receipt,
      viewerSigner: page.viewerSigner,
      duplicate,
    })
    const options =
      receipt && !choices.some((choice) => choice.value === receipt.id)
        ? [{ value: receipt.id, label: `${receipt.number} · ${receipt.person.name}` }, ...choices]
        : choices
    return { file, receipt, outcome, options, matchedByHand: receiptId !== file.receiptId && receiptId !== null }
  })
  const ready = rows.filter((row) => row.outcome === "ready")
  const tally = (outcome: SignedFileOutcome) => rows.filter((row) => row.outcome === outcome).length

  async function read(files: File[]) {
    if (files.length === 0) return
    const form = new FormData()
    for (const file of files) form.append("files", file)
    setReading(true)
    setReadError(null)
    try {
      const result = await preview({ data: form })
      setUpload(result)
      setAssigned(Object.fromEntries(result.files.map((file) => [file.fileId, file.receiptId])))
    } catch (caught) {
      console.error(caught)
      setReadError(errorMessage(caught, "Couldn't read the files. Try again."))
    } finally {
      setReading(false)
    }
  }

  function remove(fileId: string) {
    if (!upload) return
    const files = upload.files.filter((file) => file.fileId !== fileId)
    setUpload(files.length ? { ...upload, files } : null)
  }

  async function submit() {
    if (!upload || ready.length === 0) return
    let result: { sent: number; failed: number }
    try {
      result = await send({
        data: {
          uploadId: upload.uploadId,
          assignments: Object.fromEntries(ready.map((row) => [row.file.fileId, row.receipt?.id ?? ""])),
        },
      })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't send the receipts. Try again."), { cause: caught })
    }
    if (result.failed === 0) await refresh(`${pluralize(result.sent, "receipt")} sent.`)
    else
      await refresh(
        `${pluralize(result.sent, "receipt")} sent, ${result.failed} not sent. Check their status below.`,
        "warning"
      )
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Upload signed receipts"
      description="Verified files are emailed to the members."
      noun="upload"
      dirty={upload !== null}
      submitLabel={ready.length ? `Send ${pluralize(ready.length, "receipt")}` : "Send receipts"}
      canSubmit={ready.length > 0}
      onSubmit={submit}
      footerStart={
        upload ? (
          <span className="hidden text-xs text-(--pn-fg-muted) shell:inline">Files that aren't ready are skipped.</span>
        ) : undefined
      }
      error={readError ?? undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-(--pn-r-4) border border-dashed border-(--pn-line-strong) bg-(--pn-sunken) px-4 py-3.5">
          <FilePickerButton
            id={inputId}
            multiple
            accept=".pdf,.p7m,application/pdf,application/pkcs7-mime"
            label={upload ? "Choose other files" : "Choose files"}
            pending={reading}
            describedBy={`${inputId}-hint`}
            onFiles={(files) => void read(files)}
          />
          <span id={`${inputId}-hint`} className="text-xs text-(--pn-fg-muted)">
            PDF or .p7m, up to 10 MB each and 50 MB in all. Choosing files again replaces the list.
          </span>
        </div>

        {upload ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-[13px]" aria-live="polite">
              <span className="font-medium tabular-nums">{pluralize(rows.length, "file")}</span>
              {(["ready", "notSigned", "otherSigner", "noReceipt", "duplicate", "notToSign"] as const).map((outcome) =>
                tally(outcome) ? (
                  <StatusBadge key={outcome} tone={OUTCOME[outcome].tone}>
                    {tally(outcome)} {OUTCOME[outcome].label.toLocaleLowerCase()}
                  </StatusBadge>
                ) : null
              )}
            </p>
            <ul className="divide-y divide-(--pn-line) rounded-(--pn-r-4) border border-(--pn-line)">
              {rows.map((row) => {
                const note = outcomeNote(row.outcome, row.receipt, page)
                const selectId = `signed-${row.file.fileId}`
                return (
                  <li key={row.file.fileId} className="flex flex-col gap-2.5 px-3 py-3 shell:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-(--pn-fg-muted)" />
                      <Hint overflowOnly label={row.file.fileName}>
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{row.file.fileName}</span>
                      </Hint>
                      <IconButton
                        label="Remove file"
                        ariaLabel={`Remove ${row.file.fileName}`}
                        icon={X}
                        onClick={() => remove(row.file.fileId)}
                      />
                    </div>
                    <div className="grid grid-cols-1 items-center gap-2 shell:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="flex min-w-0 flex-col gap-1">
                        <label htmlFor={selectId} className="sr-only">
                          Receipt for {row.file.fileName}
                        </label>
                        <SelectField
                          id={selectId}
                          value={row.receipt?.id ?? null}
                          options={row.options}
                          placeholder="Choose receipt"
                          onChange={(receiptId) =>
                            setAssigned((current) => ({ ...current, [row.file.fileId]: receiptId }))
                          }
                        />
                        {row.matchedByHand ? (
                          <span className="text-xs text-(--pn-fg-muted)">Matched by hand</span>
                        ) : null}
                      </div>
                      <span className="flex flex-col items-start gap-1 shell:items-end">
                        <StatusBadge tone={OUTCOME[row.outcome].tone}>{OUTCOME[row.outcome].label}</StatusBadge>
                      </span>
                    </div>
                    {note ? <p className="text-xs text-(--pn-fg-muted)">{note}</p> : null}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <InlineAlert tone="info">
            Keep the receipt number in the filename, e.g.{" "}
            <span className="font-mono">Ricevuta_2026-042_firmata.pdf</span>.
          </InlineAlert>
        )}
      </div>
    </FormDialog>
  )
}

/** Voids a receipt with a reason. Receipts are never deleted; this year's fee goes back to Due. */
export function VoidReceiptDialog({
  open,
  onOpenChange,
  receipt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receipt: Receipt
}) {
  const save = useServerFn(voidReceipt)
  const refresh = useRefreshAfter()
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const error = submitted && !reason.trim() ? "Say why the receipt is voided." : undefined

  async function submit() {
    setSubmitted(true)
    if (!reason.trim()) return
    try {
      await save({ data: { receiptId: receipt.id, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't void the receipt. Try again."), { cause: caught })
    }
    await refresh(`Receipt ${receipt.number} voided.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Void receipt ${receipt.number}?`}
      description={`${receipt.person.name}'s receipt stays in the list with its number, marked Voided.${receipt.year === currentYear() ? " If this is the current fee’s only receipt, the fee reopens for correction." : ""}`}
      noun="void"
      dirty={reason.trim() !== ""}
      submitLabel="Void receipt"
      submitTone="danger"
      onSubmit={submit}
    >
      <FormField
        label="Reason"
        htmlFor="void-reason"
        hint="Shown on the receipt and in the record's activity."
        error={error}
      >
        <Textarea
          id="void-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={fieldHintId("void-reason")}
          className={cn(fieldControl, "min-h-20")}
        />
      </FormField>
    </FormDialog>
  )
}
