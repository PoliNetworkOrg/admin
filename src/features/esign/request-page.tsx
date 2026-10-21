import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowRight, Ban, Download, Files, FolderUp, Mail, RotateCw, Send, Trash2, X } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"

import {
  buttonMotion,
  buttonTones,
  ConfirmDialog,
  FormDialog,
  FormField,
  fieldControl,
  Hint,
  InlineAlert,
  inlineLink,
  LoadingButton,
  SectionCard,
  Spinner,
  StatusBadge,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { EsignDrive, EsignPdfInfo, EsignRequestDetail } from "@/lib/api/types"
import { errorHasCode } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { computerOnly, EsignActionCard } from "./action-card"
import { declineEsignRequest, getEsignDocumentContent } from "./esign.functions"
import { type PdfFocus, PdfViewer, usePdfBytes } from "./pdf-viewer"
import { kindsLabel, type Place, placeAt, placesLeft } from "./places"
import { MoveBoxButton, PlacingCancel, placingStatus } from "./placing"
import { isDelivering, openPoint, type RequestCard, requestCardState } from "./request-card"
import { SignerStatusBadge, YouChip } from "./request-status"
import { cancelEsignRequest, deleteEsignRequest, retryEsignDelivery } from "./requests.functions"
import { SignTrigger, useSignWithCie } from "./sign-with-cie"
import { SignatureBox } from "./signature-box"
import { useKnownBrowser, useSigningDevice } from "./signing-device"
import { useReloadWhile } from "./use-reload-while"

type EventData = { sub?: string; name?: string; path?: string; to?: string[]; error?: string; reason?: string | null }

/**
 * The boxes the viewer just signed, kept over their spots until the new version is drawn there (`painted`) and the
 * signing dialog has closed (`released`); then they dissolve into the stamps.
 */
type Ghosts = {
  places: (Place & { at: number })[]
  label: string
  role: string | null
  number?: number
  painted: boolean
  released: boolean
  /** Painted before the dialog closed, so the fade waits for the dialog's exit. */
  afterDialog: boolean
}

type Detail = Omit<EsignRequestDetail, "events"> & {
  events: (Omit<EsignRequestDetail["events"][number], "data"> & { data: EventData })[]
  pdf: EsignPdfInfo | null
  me: string
  config: { drives: EsignDrive[]; canManage: boolean }
  /** Other documents waiting for the viewer's signature. */
  waiting: { count: number; next: { id: string; title: string } | null }
}

/** What the action card and the Signers rows already say: the emails and the saved copy. */
const CARD_EVENTS = new Set(["uploaded", "emailed", "notified", "notify_failed"])

function eventText(event: Detail["events"][number], names: Map<string, string>) {
  const who = event.actorSub ? (names.get(event.actorSub) ?? "Someone") : null
  const { data } = event
  switch (event.type) {
    case "created":
      return `${who} created the request`
    case "signed":
      return `${data.name ?? who} signed with CIE`
    case "completed":
      return "All signatures collected"
    case "delivery_failed":
      return `Delivery failed: ${data.error ?? "unknown error"}`
    case "cancelled":
      return `${who} cancelled the request`
    case "declined":
      return `${who} declined`
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

/** "Verbali/Verbale.pdf", or the bare file name at the drive's root. */
function outputPath(output: { folderPath: string }, name: string) {
  return output.folderPath ? `${output.folderPath}/${name}` : name
}

export function EsignRequestPage({ detail }: { detail: Detail }) {
  const router = useRouter()
  const navigate = useNavigate()
  const canManage = useCan("esign:requests:manage")
  const device = useSigningDevice()
  const knownBrowser = useKnownBrowser()
  const contentFn = useServerFn(getEsignDocumentContent)
  const declineFn = useServerFn(declineEsignRequest)
  const cancelFn = useServerFn(cancelEsignRequest)
  const deleteFn = useServerFn(deleteEsignRequest)
  const retryFn = useServerFn(retryEsignDelivery)
  const { request, events, currentDocumentId, signingNow, pdf, me } = detail
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyId = useId()
  const lockId = useId()
  // After a decline or cancel the card's sentence says what happened, and the button that did it is gone: focus goes
  // there. A dialog closed without acting returns focus to its trigger.
  const acted = useRef(false)
  const focusOutcome = () => {
    const target = acted.current ? bodyRef.current : null
    acted.current = false
    return target
  }

  const [content, setContent] = useState<{ base64: string; fileName: string; documentId: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const bytes = usePdfBytes(content?.base64 ?? null)

  useEffect(() => {
    if (!currentDocumentId) return
    let cancelled = false
    setLoadError(null)
    contentFn({ data: { documentId: currentDocumentId } })
      .then((result) => {
        if (!cancelled) setContent({ ...result, documentId: currentDocumentId })
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
  // The viewer's boxes as they drag them; fixed once some of them are signed. Reloads bring the saved places as new
  // arrays, so the dragged ones reset only when the saved ones change.
  const savedPlaces = mySigner?.places ?? []
  const savedKey = JSON.stringify(savedPlaces)
  const [myPlaces, setMyPlaces] = useState<Place[]>(savedPlaces)
  const [placesKey, setPlacesKey] = useState(savedKey)
  if (placesKey !== savedKey) {
    setPlacesKey(savedKey)
    setMyPlaces(savedPlaces)
  }
  const myDone = mySigner?.signaturesDone ?? 0
  // Phones review only: the box stays where it is.
  const editable = myTurn && myDone === 0 && device !== "phone"
  /** The place waiting for a click on its new spot; placing ends by itself once the boxes are fixed. */
  const [placing, setPlacing] = useState<number | null>(null)
  const placingAt = editable ? placing : null
  const myLeft = placesLeft(
    myPlaces.map((place, at) => ({ ...place, at })),
    myDone
  )

  // From the first data only: following the box as it moves would scroll it away from the pointer. After signing it
  // moves to the signed spot, if that isn't in view.
  const [focus, setFocus] = useState<PdfFocus | null>(() => openPoint(request, me, new Date()))

  // After placing, by a click on a page or Esc, focus returns to Move box.
  const moveRef = useRef<HTMLButtonElement>(null)
  const wasPlacing = useRef(false)
  useEffect(() => {
    if (placingAt !== null) wasPlacing.current = true
    else if (wasPlacing.current) {
      wasPlacing.current = false
      moveRef.current?.focus({ preventScroll: true })
    }
  }, [placingAt])

  const card = requestCardState(detail, {
    me,
    canManage,
    device,
    knownBrowser,
    now: new Date(),
    places: myTurn ? myPlaces : undefined,
  })

  const [ghosts, setGhosts] = useState<Ghosts | null>(null)
  /** The hand-off waits for this page of a version other than `from` to be drawn. */
  const awaitedPaint = useRef<{ from: string | null; page: number; resolve: () => void } | null>(null)

  /**
   * Runs behind the signing dialog once the signature is saved: the boxes stay where they were signed, the page
   * reloads into its outcome, and the new version is drawn under them before the dialog lets go.
   */
  async function handOff() {
    const first = myLeft[0]
    let painted = Promise.resolve()
    if (first && mySigner) {
      const index = request.signers.findIndex((s) => s.id === mySigner.id)
      setGhosts({
        places: myLeft,
        label: mySigner.name,
        role: mySigner.role,
        number: request.signers.length > 1 ? index + 1 : undefined,
        painted: false,
        released: false,
        afterDialog: false,
      })
      setFocus({ page: first.page, y: first.y + first.height / 2, height: first.height, ifHidden: true })
      painted = new Promise((resolve) => {
        awaitedPaint.current = { from: currentDocumentId, page: first.page, resolve }
      })
    }
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    await painted
  }

  function onPainted(page: number) {
    const awaited = awaitedPaint.current
    if (!awaited || page !== awaited.page || content?.documentId === awaited.from) return
    awaitedPaint.current = null
    // Painted before the dialog let go, `released` makes the fade wait for its exit; painted after it (the hand-off
    // stopped waiting), the fade starts at once.
    setGhosts((current) => current && { ...current, painted: true, afterDialog: false })
    awaited.resolve()
  }

  /** The dialog is closing: the boxes dissolve into the stamps, or go at once without motion. */
  function released() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    setGhosts((current) => {
      if (!current || (reduced && current.painted)) return null
      return { ...current, released: true, afterDialog: current.painted }
    })
  }

  const signing = useSignWithCie({
    items: [{ requestId: request.id, title: request.title, places: myDone === 0 ? myPlaces : undefined }],
    handOff,
    onSigned: released,
    finalFocus: () => bodyRef.current,
  })

  // Delivery (OneDrive, email) runs after the last signature: follow it until it settles.
  useReloadWhile(isDelivering(request), 2000)
  // Another signer holds the request: follow it until they finish, so Sign with CIE turns on by itself.
  const lockedBy = myTurn && signingNow && signingNow.sub !== me ? signingNow : null
  useReloadWhile(lockedBy !== null, 3000)
  // The next signer's email is on its way: follow it until the card can say it was sent.
  useReloadWhile(card.emailing, 2000)

  const names = useMemo(() => {
    const map = new Map(request.signers.map((s) => [s.sub, s.name]))
    map.set(request.createdBySub, request.createdByName)
    return map
  }, [request])

  // For each signer whose turn it is, other than the viewer: when they were emailed, or why they couldn't be.
  const turnNotes = useMemo(() => {
    const notes = new Map<string, { note?: string; warning?: string }>()
    for (const event of events) {
      const sub = event.data.sub
      if (!sub || sub === me || !request.turn.includes(sub)) continue
      if (event.type === "notified") notes.set(sub, { note: `Emailed ${formatDateTime(new Date(event.at))}` })
      if (event.type === "notify_failed")
        notes.set(sub, {
          warning: event.data.reason === "no_email" ? "Couldn't email them: no email address" : "Couldn't email them",
        })
    }
    return notes
  }, [events, request, me])

  const inProgress = request.status === "in_progress"
  const deliveryPlanned = request.output !== null || (request.email?.to.length ?? 0) > 0
  const drive = detail.config.drives.find((d) => d.id === request.output?.driveId)?.label ?? "OneDrive"
  // A request in progress is cancelled first; a pending delivery still needs the request.
  const canDelete = !inProgress && request.delivery?.status !== "pending" && canManage
  const pages = pdf?.pages ?? []
  const soleSigner = request.signers.length === 1 && request.signers[0].sub === me
  const pendingCount = request.signers.filter((s) => s.status === "pending").length
  const details = useScrolls()

  const [declineOpen, setDeclineOpen] = useState(false)
  // Cancel and Delete live outside the card: confirming changes the card's red button, and the dialog has to keep its
  // words while it closes.
  const [cancelOpen, setCancelOpen] = useState(false)
  /** Who was signing when Cancel request opened. */
  const [cancelHolder, setCancelHolder] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [retrying, setRetrying] = useState(false)

  async function decline() {
    await declineFn({ data: { id: request.id, reason: reason.trim() || null } })
    acted.current = true
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    setDeclineOpen(false)
  }

  async function retry() {
    setRetrying(true)
    let failure: string | null = null
    try {
      await retryFn({ data: { id: request.id } })
    } catch (error) {
      console.error(error)
      failure = error instanceof Error ? error.message : "Couldn't deliver the document."
    }
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    setRetrying(false)
    // A retry that ran and failed again shows in the card's alert instead.
    if (failure !== null) appToast.error(failure)
  }

  const dangerClass = cn(buttonMotion, buttonTones.dangerOutline, "self-start")
  const deleteButton = (
    <Button variant="outline" size="sm" className={dangerClass} onClick={() => setDeleteOpen(true)}>
      <Trash2 aria-hidden /> Delete request
    </Button>
  )
  const danger =
    card.danger === "decline" ? (
      <Button variant="outline" size="sm" className={dangerClass} onClick={() => setDeclineOpen(true)}>
        <X aria-hidden /> Decline
      </Button>
    ) : card.danger === "cancel" ? (
      <Button
        variant="outline"
        size="sm"
        className={dangerClass}
        onClick={() => {
          setCancelHolder(signingNow && signingNow.sub !== me ? signingNow.name : null)
          setCancelOpen(true)
        }}
      >
        <Ban aria-hidden /> Cancel request
      </Button>
    ) : card.danger === "delete" ? (
      deleteButton
    ) : null

  return (
    <>
      <PageBar
        width="record"
        back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }}
        right={
          <Button
            variant="outline"
            className="h-10"
            disabled={!bytes || !content}
            onClick={() => bytes && content && downloadBytes(bytes, content.fileName)}
          >
            <Download aria-hidden /> Download PDF
          </Button>
        }
      />
      <PageContent width="record">
        {/* Two columns once the content is 896px wide, leaving the viewer about 520px beside the 360px column: the
            viewer sets the height, and the rest scrolls by itself under the card, which stays put. */}
        <div className="@container">
          <div className="grid gap-4 @min-[896px]:grid-cols-[minmax(0,1fr)_360px] @min-[896px]:grid-rows-[auto_minmax(160px,1fr)]">
            <div className="min-w-0 @min-[896px]:col-start-2 @min-[896px]:row-start-1">
              <EsignActionCard
                title={request.title}
                badge={<StatusBadge tone={card.badge.tone}>{card.badge.label}</StatusBadge>}
                meta={card.meta}
                body={card.body}
                bodyId={bodyId}
                bodyRef={bodyRef}
                note={card.note}
                muted={card.muted && <ReadyLine muted={card.muted} />}
                lock={card.lock}
                lockId={lockId}
                primary={
                  card.primary && (
                    <CardPrimary
                      card={card}
                      requestId={request.id}
                      signing={signing}
                      describedBy={card.lock ? lockId : undefined}
                    />
                  )
                }
                primarySigns={card.primary?.kind !== "sendAgain"}
                footerStart={
                  card.signTogether !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(buttonMotion, "-ml-2.5")}
                      nativeButton={false}
                      render={
                        <Link
                          to="/dashboard/esign/sign"
                          search={{ first: request.id }}
                          // Boxes moved here would otherwise snap back in a document the batch counts as checked.
                          state={
                            editable && savedKey !== JSON.stringify(myPlaces)
                              ? { esignMoved: { [request.id]: myPlaces } }
                              : {}
                          }
                        />
                      }
                    >
                      <Files aria-hidden /> Sign {card.signTogether} together
                    </Button>
                  )
                }
                footerEnd={danger}
                device={device}
              >
                <CardOutcome card={card} retrying={retrying} onRetry={retry} />
              </EsignActionCard>
            </div>

            <div className="min-w-0 @min-[896px]:col-start-1 @min-[896px]:row-span-2 @min-[896px]:row-start-1">
              {loadError ? (
                <InlineAlert>{loadError}</InlineAlert>
              ) : (
                <PdfViewer
                  data={bytes}
                  pages={pages}
                  focus={focus}
                  onPainted={onPainted}
                  cursor={placingAt !== null ? "crosshair" : "default"}
                  onPageClick={(page, x, y) => {
                    if (placingAt === null) return
                    setMyPlaces((current) =>
                      current.map((p, at) => (at === placingAt ? placeAt(p, pages, page, x, y) : p))
                    )
                    setPlacing(null)
                  }}
                  status={placingAt !== null ? placingStatus(myPlaces, placingAt) : null}
                  statusAction={placingAt !== null && <PlacingCancel onCancel={() => setPlacing(null)} />}
                  toolbarStart={
                    editable &&
                    myPlaces.length > 0 && (
                      <div className={device === "unknown" ? computerOnly : undefined}>
                        <MoveBoxButton ref={moveRef} places={myPlaces} onPlacing={setPlacing} />
                      </div>
                    )
                  }
                  overlay={(page) => (
                    <>
                      {request.signers.flatMap((signer, index) => {
                        if (!inProgress || signer.status !== "pending") return []
                        const mine = myTurn && signer.id === mySigner?.id
                        const left = mine
                          ? myLeft
                          : placesLeft(
                              signer.places.map((place, at) => ({ ...place, at })),
                              signer.signaturesDone
                            )
                        return left
                          .filter((place) => place.page === page)
                          .map((place) => (
                            <SignatureBox
                              key={`${signer.id}-${place.at}`}
                              placement={place}
                              label={signer.name}
                              role={signer.role}
                              number={request.signers.length > 1 ? index + 1 : undefined}
                              kind={place.kind}
                              state={mine ? "active" : "pending"}
                              editable={mine && editable}
                              onChange={(moved) =>
                                setMyPlaces((current) =>
                                  current.map((p, at) => (at === place.at ? { ...moved, kind: p.kind } : p))
                                )
                              }
                            />
                          ))
                      })}
                      {ghosts?.places
                        .filter((place) => place.page === page)
                        .map((place) => (
                          <SignatureBox
                            key={`signed-${place.at}`}
                            placement={place}
                            label={ghosts.label}
                            role={ghosts.role}
                            number={ghosts.number}
                            kind={place.kind}
                            state="active"
                            leaving={ghosts.released && ghosts.painted ? "fading" : "waiting"}
                            afterDialog={ghosts.afterDialog}
                            onLeft={() => setGhosts(null)}
                          />
                        ))}
                    </>
                  )}
                />
              )}
            </div>

            <div className="relative min-w-0 @min-[896px]:col-start-2 @min-[896px]:row-start-2 @min-[896px]:min-h-40">
              {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll area of its own, which Safari doesn't focus */}
              <div
                ref={details.ref}
                // A tab stop only while it scrolls: in one column, or with little to show, it would do nothing.
                tabIndex={details.scrolls ? 0 : undefined}
                role="region"
                aria-label="Request details"
                className="@min-[896px]:absolute @min-[896px]:inset-0 @min-[896px]:overflow-y-auto"
              >
                <div className="flex flex-col gap-4">
                  {!soleSigner && (
                    <SectionCard title="Signers" count={request.signers.length}>
                      <ol className="flex flex-col gap-3">
                        {request.signers.map((signer, index) => {
                          const turn = request.turn.includes(signer.sub)
                          const turnNote = signer.sub === card.notedSub ? undefined : turnNotes.get(signer.sub)
                          const meta = [
                            signer.role,
                            signer.places.length > 1 && kindsLabel(signer.places),
                            signer.signedAt && formatDateTime(new Date(signer.signedAt)),
                            turnNote?.note,
                          ].filter(Boolean)
                          return (
                            <li key={signer.id} className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold tabular-nums",
                                  signer.status === "signed"
                                    ? "bg-(--pn-success-bg) text-(--pn-success-fg)"
                                    : turn
                                      ? "bg-(--pn-accent-soft) text-(--pn-accent)"
                                      : "bg-(--pn-muted) text-(--pn-fg-muted)"
                                )}
                              >
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-[14px] font-medium">{signer.name}</span>
                                    {signer.sub === me && <YouChip />}
                                  </span>
                                  <SignerStatusBadge
                                    signer={signer}
                                    turn={turn}
                                    mine={signer.sub === me}
                                    requestStatus={request.status}
                                  />
                                </div>
                                {meta.length > 0 && (
                                  <div className="text-[13px] text-(--pn-fg-muted) tabular-nums">
                                    {meta.join(" · ")}
                                  </div>
                                )}
                                {turnNote?.warning && (
                                  <div className="text-[12px] text-(--pn-warning-fg)">{turnNote.warning}</div>
                                )}
                                {signer.status === "signed" && signer.certificateIssuer && (
                                  <div
                                    className="truncate text-[12px] text-(--pn-fg-muted)"
                                    title={signer.certificateSubject ?? undefined}
                                  >
                                    CIE · {signer.fiscalCode ?? signer.certificateIssuer}
                                  </div>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                      {inProgress && !request.ordered && pendingCount > 1 && (
                        <p className="mt-3 text-[12px] text-(--pn-fg-muted)">Signers can sign in any order.</p>
                      )}
                    </SectionCard>
                  )}

                  {inProgress && deliveryPlanned && (
                    <SectionCard title="Delivery">
                      <ul className="flex flex-col gap-3 text-[14px]">
                        {request.output && (
                          <li className="flex items-start gap-2.5">
                            <FolderUp aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
                            <span className="min-w-0 break-words">
                              Will be saved to {drive}: {outputPath(request.output, request.output.fileName)}
                            </span>
                          </li>
                        )}
                        {request.email?.to.length ? (
                          <li className="flex items-start gap-2.5">
                            <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
                            <span className="min-w-0 break-words">
                              Will be emailed to {request.email.to.join(", ")}
                            </span>
                          </li>
                        ) : null}
                      </ul>
                    </SectionCard>
                  )}

                  <SectionCard title="Activity">
                    <ol className="flex flex-col gap-2.5">
                      {events
                        .filter((event) => !CARD_EVENTS.has(event.type))
                        .reverse()
                        .map((event) => (
                          <li key={event.id} className="flex flex-col">
                            <span className="text-[14px] text-pretty">{eventText(event, names)}</span>
                            <span className="text-[12px] text-(--pn-fg-muted) tabular-nums">
                              {formatDateTime(new Date(event.at))}
                            </span>
                          </li>
                        ))}
                    </ol>
                  </SectionCard>

                  {/* Declined and cancelled requests have it in the card; there a red button doesn't read as an alarm. */}
                  {request.status === "completed" && canDelete && deleteButton}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContent>

      <FormDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Decline request?"
        description={
          request.createdBySub === me
            ? "The request stops."
            : `The request stops. ${request.createdByName} gets an email with your reason.`
        }
        noun="reason"
        dirty={reason.trim() !== ""}
        submitLabel="Decline request"
        onSubmit={decline}
        finalFocus={focusOutcome}
      >
        <FormField label="Reason" htmlFor="esign-decline-reason" optional counter={{ length: reason.length, max: 500 }}>
          <Textarea
            id="esign-decline-reason"
            className={fieldControl}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </FormDialog>

      {signing.dialog}

      {canManage && (
        <ConfirmDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          title="Cancel request?"
          description={
            <>
              Nobody will be able to sign it anymore. Signatures already added stay in the document.
              {cancelHolder && ` ${cancelHolder} is signing it right now and won't be able to finish.`}
            </>
          }
          confirmLabel="Cancel request"
          cancelLabel="Keep request"
          tone="danger"
          icon={Ban}
          finalFocus={focusOutcome}
          onConfirm={async () => {
            await cancelFn({ data: { id: request.id } })
            acted.current = true
            try {
              await router.invalidate({ sync: true })
            } catch (error) {
              console.error(error)
            }
          }}
        />
      )}

      {canManage && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete request?"
          description={
            request.delivery?.driveItem
              ? "Its signers, activity and every version of the document are deleted. The copy saved to OneDrive stays."
              : "Its signers, activity and every version of the document are deleted. Download the PDF first if you need it."
          }
          confirmLabel="Delete request"
          tone="danger"
          icon={Trash2}
          onConfirm={async () => {
            try {
              await deleteFn({ data: { id: request.id } })
            } catch (error) {
              console.error(error)
              // Already gone: the outcome the user asked for.
              if (!errorHasCode(error, "NOT_FOUND")) throw error
            }
            try {
              // Leave first: reloading this page would look the deleted request up again.
              await navigate({ to: "/dashboard/esign/requests" })
              await router.invalidate({ sync: true })
            } catch (error) {
              console.error(error)
            }
            appToast.success("Request deleted.")
          }}
        />
      )}
    </>
  )
}

/** The muted line under "Check the blue box": what signing needs, or the setup guide for a browser new to it. */
function ReadyLine({ muted }: { muted: NonNullable<RequestCard["muted"]> }) {
  if (muted === "ready") return "You need the card, its PIN and the reader."
  return (
    <>
      First time on this computer? {/* A new tab, because the boxes moved here aren't saved yet. */}
      <Link to="/dashboard/esign/setup" target="_blank" rel="noreferrer" className={inlineLink}>
        Set it up first
      </Link>
      .
    </>
  )
}

function CardPrimary({
  card,
  requestId,
  signing,
  describedBy,
}: {
  card: RequestCard
  requestId: string
  signing: ReturnType<typeof useSignWithCie>
  describedBy: string | undefined
}) {
  const primary = card.primary
  if (!primary) return null
  if (primary.kind === "sign")
    return <SignTrigger signing={signing} disabled={card.lock !== null} describedBy={describedBy} className="w-full" />
  if (primary.kind === "next")
    return (
      <Hint label={`Next to sign: ${primary.title}`} overflowOnly>
        <Button
          className={cn(buttonMotion, "h-10 w-full")}
          nativeButton={false}
          render={<Link to="/dashboard/esign/requests/$requestId" params={{ requestId: primary.id }} />}
        >
          <span className="min-w-0 truncate">Next to sign: {primary.title}</span>
          <ArrowRight aria-hidden />
        </Button>
      </Hint>
    )
  return (
    <Button
      className={cn(buttonMotion, "h-10 w-full")}
      nativeButton={false}
      render={<Link to="/dashboard/esign/new" search={{ from: requestId }} />}
    >
      <Send aria-hidden /> Send again
    </Button>
  )
}

/** A completed request's delivery, line by line, or why it failed. */
function CardOutcome({ card, retrying, onRetry }: { card: RequestCard; retrying: boolean; onRetry: () => void }) {
  if (card.failure)
    return (
      <InlineAlert
        className="mt-3"
        action={
          card.retry ? (
            <LoadingButton variant="outline" size="sm" icon={RotateCw} pending={retrying} onClick={onRetry}>
              Retry
            </LoadingButton>
          ) : undefined
        }
      >
        {card.failure}
      </InlineAlert>
    )
  if (card.delivery.length === 0) return null
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {card.delivery.map((line) => (
        <li key={line.kind} className="flex items-start gap-2">
          {line.pending ? (
            <Spinner className="mt-0.5 shrink-0 text-(--pn-fg-muted)" />
          ) : line.kind === "folder" ? (
            <FolderUp aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
          ) : (
            <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
          )}
          <span className="min-w-0 break-words">
            {line.text}
            {line.kind === "folder" &&
              (line.href ? (
                <a className={inlineLink} href={line.href} target="_blank" rel="noreferrer">
                  {line.file}
                </a>
              ) : (
                line.file
              ))}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Whether the element given to `ref` scrolls: its content is taller than it. */
function useScrolls() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [scrolls, setScrolls] = useState(false)
  useLayoutEffect(() => {
    if (!element) return
    // The element resizes with the layout, its content with every reload.
    const observer = new ResizeObserver(() => setScrolls(element.scrollHeight > element.clientHeight + 1))
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [element])
  return { ref: setElement, scrolls }
}
