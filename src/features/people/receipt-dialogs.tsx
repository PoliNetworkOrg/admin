import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { FileText, Upload, X } from "lucide-react"
import { useId, useRef, useState } from "react"

import {
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  LoadingButton,
  StatusBadge,
  type StatusTone,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Textarea } from "@/components/ui/textarea"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { type SignedFileOutcome, signedFileOutcome } from "./people-fees"
import { voidReceipt } from "./people-fees.functions"
import { CURRENT_YEAR, SIGNER_LABEL } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { previewSignedReceipts, sendSignedReceipts } from "./people-receipts.functions"
import { SelectField } from "./people-ui"
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
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
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

  async function read(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (inputRef.current) inputRef.current.value = ""
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
      setReadError(
        caught instanceof Error
          ? errorMessage(caught, "The files couldn't be read. Try again.")
          : "The files couldn't be read. Try again."
      )
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
      throw new Error(
        caught instanceof Error
          ? errorMessage(caught, "The receipts couldn't be sent. Try again.")
          : "The receipts couldn't be sent. Try again.",
        { cause: caught }
      )
    }
    const message =
      result.failed === 0
        ? `${pluralize(result.sent, "receipt")} sent.`
        : `${pluralize(result.sent, "receipt")} sent, but ${pluralize(result.failed, "email")} failed. Check Send failed.`
    try {
      await router.invalidate({ sync: true })
      if (result.failed === 0) appToast.success(message)
      else appToast.warning(message)
    } catch (caught) {
      console.error(caught)
      appToast.warning(`${message.replace(/\.$/, "")}, but the page couldn't refresh.`)
    }
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Upload signed receipts"
      description="Add the files you signed with the CIE app. Each is matched by the receipt number in its name; check the matches, then send."
      noun="upload"
      dirty={upload !== null}
      submitLabel={`Send ${pluralize(ready.length, "receipt")}`}
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
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept=".pdf,.p7m,application/pdf,application/pkcs7-mime"
            className="sr-only"
            tabIndex={-1}
            aria-describedby={`${inputId}-hint`}
            onChange={(event) => void read(event.target.files)}
          />
          <LoadingButton
            type="button"
            variant="outline"
            icon={Upload}
            pending={reading}
            onClick={() => inputRef.current?.click()}
          >
            {upload ? "Add other files" : "Choose files"}
          </LoadingButton>
          <span id={`${inputId}-hint`} className="text-xs text-(--pn-fg-muted)">
            PDF or .p7m, up to 10 MB each. Adding files again replaces the list.
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
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={row.file.fileName}>
                        {row.file.fileName}
                      </span>
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
            Download the receipts to sign, sign each PDF with the CIE app, then add the signed files here. Keep the
            receipt number in the file names, as in <span className="font-mono">Ricevuta_2026-042_firmata.pdf</span>.
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
      throw new Error(
        caught instanceof Error
          ? errorMessage(caught, "The receipt couldn't be voided. Try again.")
          : "The receipt couldn't be voided. Try again.",
        { cause: caught }
      )
    }
    await refresh(`Receipt ${receipt.number} voided.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Void receipt ${receipt.number}?`}
      description={`${receipt.person.name}'s receipt stays in the list with its number, marked Voided.${receipt.year === CURRENT_YEAR ? " The fee goes back to Due, so it can be marked as paid again with the right details." : ""}`}
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
