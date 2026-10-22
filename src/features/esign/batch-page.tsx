import { Link, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowRight, Check, ExternalLink, FileSignature, Plus, X } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react"

import { buttonMotion, EmptyState, IconButton, InlineAlert, inlineLink } from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { EsignPdfInfo, EsignRequestDetail } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { computerOnly, EsignActionCard } from "./action-card"
import { getEsignDocumentContent } from "./esign.functions"
import { PdfViewer, usePdfBytes } from "./pdf-viewer"
import { type Place, pagesShort, placeAt, placesLeft } from "./places"
import { MoveBoxButton, PlacingCancel, placingStatus } from "./placing"
import { PHONE_NOTE } from "./request-card"
import { SignTrigger } from "./sign-with-cie"
import { SignatureBox } from "./signature-box"
import { useKnownBrowser, useSigningDevice } from "./signing-device"
import { useHostedSignWithCie } from "./signing-host"
import { useReloadWhile } from "./use-reload-while"

type Item = Pick<EsignRequestDetail, "request" | "currentDocumentId" | "signingNow"> & { pdf: EsignPdfInfo | null }

const BACK = { label: "documents to sign", link: { to: "/dashboard/esign/inbox" } } as const

/**
 * Signs the documents waiting for the viewer together: a strip of documents to check one by one, where the viewer's
 * boxes can still be moved, then one "Sign" that opens a single agent window and one PIN for all of them.
 */
export function EsignBatchPage({
  items,
  more,
  me,
  moved: carried,
}: {
  items: Item[]
  more: number
  me: string
  /** Boxes already moved on the request page the viewer came from, by request id. */
  moved?: Record<string, Place[]>
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const device = useSigningDevice()
  const knownBrowser = useKnownBrowser()
  const contentFn = useServerFn(getEsignDocumentContent)
  const bodyId = useId()
  const lockId = useId()
  /** PDF contents by document id (a version never changes), so Next opens a document fetched in advance. */
  const pdfs = useRef(new Map<string, Promise<string>>())
  const loadPdf = useCallback(
    (documentId: string) => {
      let pdf = pdfs.current.get(documentId)
      if (!pdf) {
        pdf = contentFn({ data: { documentId } }).then((result) => result.base64)
        pdfs.current.set(documentId, pdf)
        // Opening the document again tries again.
        void pdf.catch((error) => {
          console.error(error)
          pdfs.current.delete(documentId)
        })
      }
      return pdf
    },
    [contentFn]
  )
  const [activeId, setActiveId] = useState(items[0]?.request.id ?? null)
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set(items[0] ? [items[0].request.id] : []))
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set())
  /** The viewer's boxes per request, as they drag them. */
  const [moved, setMoved] = useState<Map<string, Place[]>>(() => new Map(Object.entries(carried ?? {})))
  /** The open document's place waiting for a click on its new spot. */
  const [placing, setPlacing] = useState<number | null>(null)

  // After placing, by a click on a page or Esc, focus returns to Move box.
  const moveRef = useRef<HTMLButtonElement>(null)
  const wasPlacing = useRef(false)
  useEffect(() => {
    if (placing !== null) wasPlacing.current = true
    else if (wasPlacing.current) {
      wasPlacing.current = false
      moveRef.current?.focus({ preventScroll: true })
    }
  }, [placing])

  // Signed documents leave the batch when the page reloads.
  const active = items.find((item) => item.request.id === activeId) ?? items[0]
  const included = items.filter((item) => !leftOut.has(item.request.id))
  const unchecked = included.filter((item) => !reviewed.has(item.request.id))
  // Follow documents another signer holds until they finish; reloads keep the review progress and moved boxes.
  useReloadWhile(
    included.some((item) => item.signingNow && item.signingNow.sub !== me),
    3000
  )

  /**
   * To sign opens behind the dialog, so it is there when the dialog lets go; the dialog lives above the routes. Then
   * every loader reloads, so the shell's To sign count agrees with the page.
   */
  async function handOff() {
    await navigate({ to: "/dashboard/esign/inbox" })
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
  }

  // Above the routes: To sign opens under the dialog once every document is signed. Closing a batch that signed only
  // some reloads this page, which may leave nothing to sign and no card.
  const signing = useHostedSignWithCie({
    items: included.map((item) => {
      const mine = item.request.signers.find((s) => s.sub === me && s.status === "pending")
      return {
        requestId: item.request.id,
        title: item.request.title,
        places: mine?.signaturesDone === 0 ? moved.get(item.request.id) : undefined,
      }
    }),
    handOff,
    // To sign only loses the documents: the toast says they were signed.
    onSigned: () =>
      appToast.success(included.length === 1 ? "Document signed." : `${included.length} documents signed.`),
  })

  const activeDocument = active?.currentDocumentId
  const nextDocument = unchecked[0]?.currentDocumentId
  useEffect(() => {
    if (!activeDocument || !nextDocument) return
    let cancelled = false
    // Once the open document has arrived, fetch the one Next opens.
    loadPdf(activeDocument)
      .then(() => {
        if (!cancelled) void loadPdf(nextDocument)
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [activeDocument, nextDocument, loadPdf])

  function open(id: string) {
    setActiveId(id)
    setPlacing(null)
    setReviewed((current) => new Set(current).add(id))
  }

  function toggle(id: string) {
    if (id === active?.request.id) setPlacing(null)
    setLeftOut((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  if (!active) {
    return (
      <>
        <PageBar width="record" back={BACK} context="Sign together" />
        <PageContent width="record">
          <EmptyState
            icon={FileSignature}
            title="Nothing left to sign"
            text="Every document that was waiting for your signature is signed."
            action={
              <Button variant="outline" nativeButton={false} render={<Link to="/dashboard/esign/inbox" />}>
                Back to documents to sign
              </Button>
            }
          />
        </PageContent>
      </>
    )
  }

  const signer = active.request.signers.find((s) => s.sub === me && s.status === "pending")
  const places = moved.get(active.request.id) ?? signer?.places ?? []
  // Phones review only: the box stays where it is.
  const editable = signer?.signaturesDone === 0 && device !== "phone"
  const out = leftOut.has(active.request.id)
  const lockedBy = active.signingNow && active.signingNow.sub !== me ? active.signingNow : null
  const signs = device !== "phone"
  const gate = device === "unknown" ? computerOnly : undefined
  const boxes = places.length > 1 ? "boxes" : "box"
  const body = out
    ? "Left out: it won't be signed now."
    : unchecked.length > 0
      ? `Check the blue ${boxes}, then open the next one.`
      : included.length === 1
        ? `Check the blue ${boxes}, then sign with CIE.`
        : `All checked. One PIN signs all ${included.length}.`

  const primary =
    included.length === 0 ? null : unchecked.length > 0 ? (
      <Button className={cn(buttonMotion, "h-10 w-full")} onClick={() => open(unchecked[0].request.id)}>
        Next document <ArrowRight aria-hidden />
      </Button>
    ) : (
      <SignTrigger signing={signing} className="w-full">
        {included.length === 1 ? "Sign with CIE" : `Sign ${included.length} documents`}
      </SignTrigger>
    )

  return (
    <>
      <PageBar
        width="record"
        back={BACK}
        context="Sign together"
        left={
          <nav aria-label="Documents to sign" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1">
            {items.map((item, index) => {
              const id = item.request.id
              const skipped = leftOut.has(id)
              const current = id === active.request.id
              return (
                <div
                  key={id}
                  className={cn(
                    "flex h-10 max-w-[260px] shrink-0 items-center rounded-(--pn-r-3) border pl-1",
                    current ? "border-(--pn-accent) bg-(--pn-accent-soft)" : "border-(--pn-line) bg-(--pn-surface)",
                    skipped && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    aria-current={current ? "page" : undefined}
                    onClick={() => open(id)}
                    className="flex h-full min-w-0 items-center gap-2 rounded-(--pn-r-2) px-2 text-left text-[13px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-(--pn-focus)/40"
                  >
                    {reviewed.has(id) && !skipped ? (
                      <Check aria-label="Checked" className="size-4 shrink-0 text-(--pn-accent)" />
                    ) : (
                      <span className="grid size-4 shrink-0 place-items-center text-[11px] text-(--pn-fg-muted) tabular-nums">
                        {index + 1}
                      </span>
                    )}
                    <span className={cn("truncate", skipped && "line-through")}>{item.request.title}</span>
                  </button>
                  {items.length > 1 && (
                    <IconButton
                      label={skipped ? `Sign ${item.request.title} too` : `Leave ${item.request.title} out`}
                      icon={skipped ? Plus : X}
                      className="size-8"
                      onClick={() => toggle(id)}
                    />
                  )}
                </div>
              )
            })}
          </nav>
        }
      />
      <PageContent width="record">
        {/* The request page's layout: two columns once the content leaves the viewer about 520px. */}
        <div className="@container">
          <div className="grid gap-4 @min-[896px]:grid-cols-[minmax(0,1fr)_360px] @min-[896px]:grid-rows-[auto_1fr]">
            <div className="min-w-0 @min-[896px]:col-start-2 @min-[896px]:row-start-1">
              <EsignActionCard
                title={active.request.title}
                titleAction={
                  // A new tab: the review progress and the moved boxes live only in this page.
                  <IconButton
                    label="Open the request"
                    icon={ExternalLink}
                    className="-mt-1 -mr-2"
                    nativeButton={false}
                    render={
                      <Link
                        to="/dashboard/esign/requests/$requestId"
                        params={{ requestId: active.request.id }}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  />
                }
                meta={[signer?.role, places.length > 0 && pagesShort(places)].filter(Boolean).join(" · ") || null}
                body={signs ? body : null}
                bodyId={bodyId}
                note={device === "computer" ? null : PHONE_NOTE}
                muted={signs && !out && !lockedBy && <ReadyLine known={knownBrowser} />}
                lock={
                  signs && !out && lockedBy
                    ? `${lockedBy.name} is signing this right now. Wait, or leave it out.`
                    : null
                }
                lockId={lockId}
                primary={signs && primary}
                primarySigns
                after={signs && more > 0 && `${more} more ${more === 1 ? "is" : "are"} waiting after these.`}
                device={device}
              >
                {signs && out && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(buttonMotion, "mt-2", gate)}
                    onClick={() => toggle(active.request.id)}
                  >
                    <Plus aria-hidden /> Sign it too
                  </Button>
                )}
              </EsignActionCard>
            </div>
            <div className="min-w-0 @min-[896px]:col-start-1 @min-[896px]:row-span-2 @min-[896px]:row-start-1">
              <DocumentViewer
                key={active.request.id}
                item={active}
                me={me}
                loadPdf={loadPdf}
                places={places}
                editable={editable}
                onMove={(next) => setMoved((current) => new Map(current).set(active.request.id, next))}
                placing={placing}
                onPlace={(page, x, y) => {
                  const next = places.map((p, at) =>
                    at === placing ? placeAt(p, active.pdf?.pages ?? [], page, x, y) : p
                  )
                  setMoved((current) => new Map(current).set(active.request.id, next))
                  setPlacing(null)
                }}
                onCancelPlacing={() => setPlacing(null)}
                toolbarStart={
                  editable &&
                  places.length > 0 && (
                    <div className={gate}>
                      <MoveBoxButton ref={moveRef} places={places} onPlacing={setPlacing} />
                    </div>
                  )
                }
              />
            </div>
          </div>
        </div>
      </PageContent>
    </>
  )
}

/** What signing needs, or the setup guide for a browser new to it. */
function ReadyLine({ known }: { known: boolean }) {
  if (known) return "You need the card, its PIN and the reader."
  return (
    <>
      First time on this computer?{" "}
      {/* A new tab, because the review progress and moved boxes live only in this page. */}
      <Link to="/dashboard/esign/setup" target="_blank" rel="noreferrer" className={inlineLink}>
        Set it up first
      </Link>
      .
    </>
  )
}

function DocumentViewer({
  item,
  me,
  loadPdf,
  places,
  editable,
  onMove,
  placing,
  onPlace,
  onCancelPlacing,
  toolbarStart,
}: {
  item: Item
  me: string
  loadPdf: (documentId: string) => Promise<string>
  places: Place[]
  /** The viewer's boxes may still move. */
  editable: boolean
  onMove: (places: Place[]) => void
  /** The place waiting for a click on its new spot. */
  placing: number | null
  onPlace: (page: number, x: number, y: number) => void
  onCancelPlacing: () => void
  toolbarStart?: ReactNode
}) {
  const [base64, setBase64] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bytes = usePdfBytes(base64)
  const { request } = item

  useEffect(() => {
    if (!item.currentDocumentId) return
    let cancelled = false
    loadPdf(item.currentDocumentId)
      .then((pdf) => {
        if (!cancelled) setBase64(pdf)
      })
      .catch((cause) => {
        console.error(cause)
        if (!cancelled) setError("Couldn't load the PDF.")
      })
    return () => {
      cancelled = true
    }
  }, [item.currentDocumentId, loadPdf])

  const mine = request.signers.find((s) => s.sub === me && s.status === "pending")
  // Once per document (it remounts for each): following the box as it moves would scroll it away from the pointer.
  const [focus] = useState(() => {
    const first = mine ? placesLeft(places, mine.signaturesDone)[0] : undefined
    return first ? { page: first.page, y: first.y + first.height / 2 } : null
  })
  if (error) return <InlineAlert>{error}</InlineAlert>
  return (
    <PdfViewer
      data={bytes}
      pages={item.pdf?.pages ?? []}
      focus={focus}
      cursor={placing !== null ? "crosshair" : "default"}
      onPageClick={placing !== null ? onPlace : undefined}
      status={placing !== null ? placingStatus(places, placing) : null}
      statusAction={placing !== null && <PlacingCancel onCancel={onCancelPlacing} />}
      toolbarStart={toolbarStart}
      overlay={(page) =>
        request.signers.flatMap((signer, index) => {
          if (signer.status !== "pending") return []
          const isMine = signer.id === mine?.id
          const left = placesLeft(
            (isMine ? places : signer.places).map((place, at) => ({ ...place, at })),
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
                number={request.ordered && request.signers.length > 1 ? index + 1 : undefined}
                kind={place.kind}
                state={isMine ? "active" : "pending"}
                editable={isMine && editable}
                onChange={(next) => onMove(places.map((p, at) => (at === place.at ? { ...next, kind: p.kind } : p)))}
              />
            ))
        })
      }
    />
  )
}
