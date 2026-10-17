import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Ban, Download, FolderUp, Mail, RotateCw, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  ConfirmDialog,
  FormDialog,
  FormField,
  fieldControl,
  InlineAlert,
  LoadingButton,
  SectionCard,
  Unset,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { EsignPdfInfo, EsignRequestDetail } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { declineEsignRequest, getEsignDocumentContent, uploadSignedEsignDocument } from "./esign.functions"
import { PdfViewer, usePdfBytes } from "./pdf-viewer"
import { RequestStatusBadge, SignerStatusBadge, signedProgress } from "./request-status"
import { cancelEsignRequest, retryEsignDelivery } from "./requests.functions"
import { SignWithCie } from "./sign-with-cie"
import { type BoxPlacement, SignatureBox } from "./signature-box"

type EventData = { sub?: string; name?: string; path?: string; to?: string[]; error?: string; reason?: string | null }

type Detail = Omit<EsignRequestDetail, "events"> & {
  events: (Omit<EsignRequestDetail["events"][number], "data"> & { data: EventData })[]
  pdf: EsignPdfInfo | null
  me: string
  config: { drive: string | null; canManage: boolean }
}

function eventText(event: Detail["events"][number], names: Map<string, string>) {
  const who = event.actorSub ? (names.get(event.actorSub) ?? "Someone") : null
  const { data } = event
  switch (event.type) {
    case "created":
      return `${who} created the request`
    case "notified":
      return `Emailed ${(data.sub && names.get(data.sub)) ?? "a signer"} that it's their turn`
    case "signed":
      return `${data.name ?? who} signed with CIE`
    case "completed":
      return "All signatures collected"
    case "uploaded":
      return `Saved to ${data.path ? `${data.path}/` : ""}${data.name ?? ""}`
    case "emailed":
      return `Emailed to ${data.to?.join(", ") ?? "the recipients"}`
    case "delivery_failed":
      return `Delivery failed: ${data.error ?? "unknown error"}`
    case "cancelled":
      return `${who} cancelled the request`
    case "declined":
      return `${who} declined${data.reason ? `: “${data.reason}”` : ""}`
    default:
      return event.type
  }
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/pdf" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function EsignRequestPage({ detail }: { detail: Detail }) {
  const router = useRouter()
  const canManage = useCan("esign:requests:manage")
  const contentFn = useServerFn(getEsignDocumentContent)
  const declineFn = useServerFn(declineEsignRequest)
  const cancelFn = useServerFn(cancelEsignRequest)
  const retryFn = useServerFn(retryEsignDelivery)
  const uploadSignedFn = useServerFn(uploadSignedEsignDocument)
  const [uploadingSigned, setUploadingSigned] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { request, events, currentDocumentId, signingNow, pdf, me } = detail

  const [content, setContent] = useState<{ base64: string; fileName: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const bytes = usePdfBytes(content?.base64 ?? null)

  useEffect(() => {
    if (!currentDocumentId) return
    let cancelled = false
    setLoadError(null)
    contentFn({ data: { documentId: currentDocumentId } })
      .then((result) => {
        if (!cancelled) setContent(result)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setLoadError("Couldn't load the PDF.")
      })
    return () => {
      cancelled = true
    }
  }, [currentDocumentId, contentFn])

  const mySigner = request.signers.find((s) => s.sub === me && s.status === "pending")
  const myTurn = request.myTurn && mySigner !== undefined
  const [placement, setPlacement] = useState<BoxPlacement | null>(mySigner?.placement ?? null)
  useEffect(() => setPlacement(mySigner?.placement ?? null), [mySigner?.placement])
  const [focus, setFocus] = useState<{ page: number; y: number } | null>(null)
  useEffect(() => {
    if (myTurn && mySigner)
      setFocus({ page: mySigner.placement.page, y: mySigner.placement.y + mySigner.placement.height / 2 })
  }, [myTurn, mySigner])

  // Delivery (OneDrive, email) runs after the last signature: follow it until it settles.
  const delivering = request.status === "completed" && request.delivery?.status === "pending"
  useEffect(() => {
    if (!delivering) return
    let busy = false
    const timer = window.setInterval(() => {
      if (busy) return
      busy = true
      router
        .invalidate()
        .catch((error) => console.error(error))
        .finally(() => {
          busy = false
        })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [delivering, router])

  const names = useMemo(() => {
    const map = new Map(request.signers.map((s) => [s.sub, s.name]))
    map.set(request.createdBySub, request.createdByName)
    return map
  }, [request])

  const canCancel = request.status === "in_progress" && canManage
  const pages = pdf?.pages ?? []

  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [retrying, setRetrying] = useState(false)

  async function decline() {
    await declineFn({ data: { id: request.id, reason: reason.trim() || null } })
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    setDeclineOpen(false)
    appToast.success("Request declined.")
  }

  async function uploadSigned(file: File) {
    setUploadingSigned(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.set("requestId", request.id)
      form.set("file", file)
      await uploadSignedFn({ data: form })
    } catch (error) {
      console.error(error)
      setUploadError(error instanceof Error ? error.message : "Couldn't upload the signed PDF.")
      setUploadingSigned(false)
      return
    }
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    setUploadingSigned(false)
    appToast.success("Document signed.")
  }

  async function retry() {
    setRetrying(true)
    try {
      const delivery = await retryFn({ data: { id: request.id } })
      if (delivery?.status === "failed") appToast.error(`Couldn't deliver the document. ${delivery.error ?? ""}`.trim())
      else appToast.success("Document delivered.")
    } catch (error) {
      console.error(error)
      appToast.error(error instanceof Error ? error.message : "Couldn't deliver the document.")
    }
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    setRetrying(false)
  }

  const actions = (
    <>
      <Button
        variant="outline"
        className="h-10"
        disabled={!bytes || !content}
        onClick={() => bytes && content && downloadBytes(bytes, content.fileName)}
      >
        <Download aria-hidden /> Download PDF
      </Button>
      {myTurn && (
        <SignWithCie
          requestId={request.id}
          placement={placement ?? undefined}
          disabled={!!signingNow && signingNow.sub !== me}
        />
      )}
    </>
  )

  return (
    <>
      <PageBar
        width="record"
        back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }}
        context={request.title}
        right={actions}
      />
      <PageContent width="record">
        <div className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {loadError ? (
              <InlineAlert>{loadError}</InlineAlert>
            ) : (
              <PdfViewer
                data={bytes}
                pages={pages}
                focus={focus}
                className="h-[calc(100dvh-210px)] min-h-[480px]"
                overlay={(page) =>
                  request.signers.map((signer, index) => {
                    if (signer.status !== "pending") return null
                    const mine = myTurn && signer.id === mySigner?.id && placement
                    const where = mine ? placement : signer.placement
                    if (where.page !== page) return null
                    return (
                      <SignatureBox
                        key={signer.id}
                        placement={where}
                        label={signer.name}
                        role={signer.role}
                        number={request.signers.length > 1 ? index + 1 : undefined}
                        state={mine ? "active" : "pending"}
                        editable={Boolean(mine)}
                        onChange={setPlacement}
                      />
                    )
                  })
                }
              />
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <SectionCard>
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-balance">
                    {request.title}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-(--pn-fg-muted)">
                  <RequestStatusBadge request={request} />
                  <span className="tabular-nums">{signedProgress(request)}</span>
                </div>
                <p className="text-[13px] text-(--pn-fg-muted)">
                  Requested by {request.createdByName} on {formatDateTime(new Date(request.createdAt))}
                </p>
              </div>
            </SectionCard>

            {myTurn && (
              <SectionCard title="Your signature">
                <p className="text-[14px] text-pretty text-(--pn-fg-muted)">
                  Drag the blue box to adjust where your signature goes, then choose Sign with CIE at the top. You need
                  the card, its PIN and the NFC reader.
                </p>
                {signingNow && signingNow.sub !== me && (
                  <InlineAlert tone="warning" className="mt-3">
                    {signingNow.name} is signing right now. Try again in a few minutes.
                  </InlineAlert>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="h-10 text-(--pn-danger-fg)" onClick={() => setDeclineOpen(true)}>
                    <X aria-hidden /> Decline
                  </Button>
                </div>
                <details className="mt-4 text-[13px] text-(--pn-fg-muted)">
                  <summary className="cursor-pointer text-(--pn-accent) select-none">Can't use the Sign Agent?</summary>
                  <p className="mt-2 text-pretty">
                    Download the PDF, sign it with the official Software CIE or CieSign app, then upload the signed
                    file. It must be this exact version with your signature added.
                  </p>
                  <label className="mt-2 inline-flex">
                    <span className="sr-only">Signed PDF</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={uploadingSigned}
                      className="text-[13px] file:mr-3 file:h-9 file:rounded-(--pn-r-3) file:border file:border-(--pn-line-strong) file:bg-(--pn-surface) file:px-3 file:text-(--pn-fg)"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ""
                        if (file) void uploadSigned(file)
                      }}
                    />
                  </label>
                  {uploadError && <InlineAlert className="mt-2">{uploadError}</InlineAlert>}
                </details>
              </SectionCard>
            )}

            <SectionCard title="Signers" count={request.signers.length}>
              <ol className="flex flex-col gap-3">
                {request.signers.map((signer, index) => (
                  <li key={signer.id} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
                        signer.status === "signed"
                          ? "bg-(--pn-success-bg) text-(--pn-success-fg)"
                          : request.turn.includes(signer.sub)
                            ? "bg-(--pn-accent-soft) text-(--pn-accent)"
                            : "bg-(--pn-muted) text-(--pn-fg-muted)"
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="truncate text-[14px] font-medium">
                          {signer.name}
                          {signer.sub === me && <span className="font-normal text-(--pn-fg-muted)"> (you)</span>}
                        </span>
                        <SignerStatusBadge signer={signer} turn={request.turn.includes(signer.sub)} />
                      </div>
                      <div className="text-[13px] text-(--pn-fg-muted)">
                        {signer.role ?? <Unset />}
                        {signer.signedAt && <> · {formatDateTime(new Date(signer.signedAt))}</>}
                      </div>
                      {signer.status === "signed" && signer.certificateIssuer && (
                        <div
                          className="truncate text-[12px] text-(--pn-fg-muted)"
                          title={signer.certificateSubject ?? undefined}
                        >
                          CIE · {signer.fiscalCode ?? signer.certificateIssuer}
                        </div>
                      )}
                      {signer.declineReason && <div className="text-[13px] text-pretty">“{signer.declineReason}”</div>}
                    </div>
                  </li>
                ))}
              </ol>
              {!request.ordered && request.signers.length > 1 && (
                <p className="mt-3 text-[12px] text-(--pn-fg-muted)">Signers can sign in any order.</p>
              )}
            </SectionCard>

            <SectionCard title="Delivery">
              <ul className="flex flex-col gap-3 text-[14px]">
                <li className="flex items-start gap-2.5">
                  <FolderUp aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
                  <span className="min-w-0">
                    {request.output ? (
                      request.delivery?.driveItem?.webUrl ? (
                        <a
                          className="break-words text-(--pn-accent) hover:underline"
                          href={request.delivery.driveItem.webUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {request.output.folderPath ? `${request.output.folderPath}/` : ""}
                          {request.delivery.driveItem.name}
                        </a>
                      ) : (
                        <span className="break-words">
                          {request.delivery?.driveItem ? "Saved to " : "Will be saved to "}
                          {detail.config.drive ?? "OneDrive"}: {request.output.folderPath || "/"}
                          {request.output.folderPath ? "/" : ""}
                          {request.delivery?.driveItem?.name ?? request.output.fileName}
                        </span>
                      )
                    ) : (
                      <span className="text-(--pn-fg-muted)">Kept in the dashboard only</span>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
                  <span className="min-w-0 break-words">
                    {request.email?.to.length ? (
                      <>
                        {request.delivery?.emailedTo.length ? "Emailed to " : "Will be emailed to "}
                        {request.email.to.join(", ")}
                      </>
                    ) : (
                      <span className="text-(--pn-fg-muted)">No email</span>
                    )}
                  </span>
                </li>
              </ul>
              {request.delivery?.status === "failed" && (
                <InlineAlert
                  className="mt-3"
                  action={
                    canManage ? (
                      <LoadingButton variant="outline" size="sm" icon={RotateCw} pending={retrying} onClick={retry}>
                        Retry
                      </LoadingButton>
                    ) : undefined
                  }
                >
                  {request.delivery.error ?? "The document couldn't be delivered."}
                </InlineAlert>
              )}
            </SectionCard>

            <SectionCard title="Activity">
              <ol className="flex flex-col gap-2.5">
                {[...events].reverse().map((event) => (
                  <li key={event.id} className="flex flex-col">
                    <span className="text-[14px] text-pretty">{eventText(event, names)}</span>
                    <span className="text-[12px] text-(--pn-fg-muted) tabular-nums">
                      {formatDateTime(new Date(event.at))}
                    </span>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {canCancel && (
              <ConfirmDialog
                title="Cancel request?"
                description="Nobody will be able to sign it anymore. Signatures already added stay in the document."
                confirmLabel="Cancel request"
                cancelLabel="Keep request"
                tone="danger"
                icon={Ban}
                trigger={
                  <Button variant="outline" className="h-10 self-start text-(--pn-danger-fg)">
                    <Ban aria-hidden /> Cancel request
                  </Button>
                }
                onConfirm={async () => {
                  await cancelFn({ data: { id: request.id } })
                  try {
                    await router.invalidate({ sync: true })
                  } catch (error) {
                    console.error(error)
                  }
                  appToast.success("Request cancelled.")
                }}
              />
            )}
          </div>
        </div>
      </PageContent>

      <FormDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline request?"
        description="The request stops and its creator sees your reason."
        noun="reason"
        dirty={reason.trim() !== ""}
        submitLabel="Decline"
        onSubmit={decline}
      >
        <FormField label="Reason" htmlFor="esign-decline-reason" optional>
          <Textarea
            id="esign-decline-reason"
            className={fieldControl}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </FormDialog>
    </>
  )
}
