import { useServerFn } from "@tanstack/react-start"
import { CircleCheck, CircleX, Copy, ExternalLink } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { IconButton, InlineAlert, Spinner } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { PdfViewer, usePdfBytes } from "@/features/esign/pdf-viewer"
import { formatDay } from "@/features/people/people-format"
import { useLoaded } from "@/features/people/people-hooks"
import { StateBadge } from "@/features/people/people-ui"
import { copyText } from "@/lib/clipboard"

import { formatEuro } from "./soci-fees"
import { FEE_STATUS, PAYMENT_METHOD } from "./soci-format"
import type { Fee, FeeFile } from "./soci.contract"
import { getFeeFile } from "./soci.functions"

export function FeeBadge({ status }: { status: Fee["status"] | null }) {
  return status ? (
    <StateBadge state={FEE_STATUS[status]} />
  ) : (
    <StateBadge state={{ label: "Not open", tone: "neutral" }} />
  )
}

/** One line on what happened to a fee: the payment, the upload waiting for review, or the last rejection. */
export function feeSummary(fee: Fee) {
  if (fee.status === "paid" && fee.payment) {
    const method = PAYMENT_METHOD[fee.payment.method]
    return `${fee.payment.method === "admission" ? method : `Paid ${formatDay(fee.payment.paidOn)} · ${method}`}${
      fee.payment.note ? ` · ${fee.payment.note}` : ""
    }`
  }
  if (fee.status === "uploaded" && fee.upload)
    return `Transfer of ${formatEuro(fee.upload.declaredCents)} on ${formatDay(fee.upload.transferDate)} · uploaded ${formatDay(fee.upload.uploadedAt)}`
  if (fee.status === "exempt") return "Admitted in the summer: no fee this year"
  if (fee.lastRejection) return `Receipt rejected ${formatDay(fee.lastRejection.at)}: ${fee.lastRejection.reason}`
  return `${formatEuro(fee.amountCents)} to pay`
}

/** The declared amount, when it isn't the fee's: the Direttivo checks it against the receipt. */
export function amountMismatch(fee: Fee) {
  return fee.upload !== null && fee.upload.declaredCents !== fee.amountCents
}

/** Opens the file in a new tab, from its bytes. */
function openInNewTab(file: FeeFile) {
  const binary = atob(file.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }))
  window.open(url, "_blank", "noopener")
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * An uploaded transfer receipt: a PDF in eSign's viewer, in its compact mode, or the image. Open in a new tab shows it
 * at full size.
 */
export function ReceiptPreview({ fileId, fileName }: { fileId: string; fileName: string }) {
  const fetchFile = useServerFn(getFeeFile)
  const load = useMemo(() => () => fetchFile({ data: { fileId } }), [fetchFile, fileId])
  const { data: file, failed } = useLoaded(load)
  const bytes = usePdfBytes(file?.contentType === "application/pdf" ? file.base64 : null)

  if (failed) return <InlineAlert tone="danger">The receipt couldn't be loaded. Close and try again.</InlineAlert>
  if (!file)
    return (
      <div
        role="status"
        className="flex h-80 items-center justify-center gap-2 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) text-[13px] text-(--pn-fg-muted)"
      >
        <Spinner />
        Loading the receipt…
      </div>
    )
  const open = (
    <IconButton
      label="Open in a new tab"
      ariaLabel={`Open ${fileName} in a new tab`}
      icon={ExternalLink}
      onClick={() => openInNewTab(file)}
    />
  )
  if (bytes) return <PdfViewer data={bytes} compact toolbarStart={open} />
  return (
    <figure className="flex flex-col gap-2">
      <div className="grid h-80 place-items-center overflow-auto rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) p-2">
        <img
          src={`data:${file.contentType};base64,${file.base64}`}
          alt={`Transfer receipt ${fileName}`}
          className="max-h-full max-w-full rounded-(--pn-r-2) object-contain"
        />
      </div>
      <figcaption className="flex items-center justify-between gap-2 text-xs text-(--pn-fg-muted)">
        <span className="truncate">{fileName}</span>
        {open}
      </figcaption>
    </figure>
  )
}

const RESULT_MS = 1500

/** A copy button that shows its result in place for 1.5s, as invite links do. */
export function CopyButton({ value, what }: { value: string; what: string }) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null)
  useEffect(() => {
    if (!result) return
    const timer = window.setTimeout(() => setResult(null), RESULT_MS)
    return () => window.clearTimeout(timer)
  }, [result])

  async function copy() {
    try {
      await copyText(value)
      setResult("copied")
      appToast.success(`${what} copied.`)
    } catch (error) {
      console.error(error)
      setResult("failed")
      appToast.error(`The ${what === what.toUpperCase() ? what : what.toLocaleLowerCase()} couldn't be copied.`)
    }
  }

  return (
    <IconButton
      // Acronyms such as IBAN keep their capitals.
      label={`Copy ${what === what.toUpperCase() ? what : what.toLocaleLowerCase()}`}
      icon={result === "copied" ? CircleCheck : result === "failed" ? CircleX : Copy}
      onClick={() => void copy()}
    />
  )
}
