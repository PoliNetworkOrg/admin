import { Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowRight, Check, ExternalLink, FileSignature, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, IconButton, InlineAlert, SectionCard } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { EsignPdfInfo, EsignRequestDetail } from "@/lib/api/types"
import { formatDateTime, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { getEsignDocumentContent } from "./esign.functions"
import { PdfViewer, usePdfBytes } from "./pdf-viewer"
import { kindsLabel, type Place, pagesLabel, placesLeft } from "./places"
import { SignWithCie } from "./sign-with-cie"
import { SignatureBox } from "./signature-box"

type Item = Pick<EsignRequestDetail, "request" | "currentDocumentId" | "signingNow"> & { pdf: EsignPdfInfo | null }

const BACK = { label: "documents to sign", link: { to: "/dashboard/esign/inbox" } } as const

/**
 * Signs the documents waiting for the viewer together: a strip of documents to check one by one, where the viewer's
 * boxes can still be moved, then one "Sign" that opens a single agent window and one PIN for all of them.
 */
export function EsignBatchPage({ items, more, me }: { items: Item[]; more: number; me: string }) {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState(items[0]?.request.id ?? null)
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set(items[0] ? [items[0].request.id] : []))
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set())
  /** The viewer's boxes per request, as they drag them. */
  const [moved, setMoved] = useState<Map<string, Place[]>>(new Map())

  // Signed documents leave the batch when the page reloads.
  const active = items.find((item) => item.request.id === activeId) ?? items[0]
  const included = items.filter((item) => !leftOut.has(item.request.id))
  const unchecked = included.filter((item) => !reviewed.has(item.request.id))

  function open(id: string) {
    setActiveId(id)
    setReviewed((current) => new Set(current).add(id))
  }

  function toggle(id: string) {
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

  const action =
    unchecked.length > 0 ? (
      <Button className="h-10" onClick={() => open(unchecked[0].request.id)}>
        Next document <ArrowRight aria-hidden />
      </Button>
    ) : (
      <SignWithCie
        items={included.map((item) => {
          const mine = item.request.signers.find((s) => s.sub === me && s.status === "pending")
          return {
            requestId: item.request.id,
            title: item.request.title,
            places: mine?.signaturesDone === 0 ? moved.get(item.request.id) : undefined,
          }
        })}
        onSigned={() => void navigate({ to: "/dashboard/esign/inbox" })}
      >
        {included.length === 1 ? "Sign with CIE" : `Sign ${included.length} documents`}
      </SignWithCie>
    )

  return (
    <>
      <PageBar
        width="record"
        back={BACK}
        context="Sign together"
        right={included.length > 0 ? action : undefined}
        left={
          <nav aria-label="Documents to sign" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1">
            {items.map((item, index) => {
              const id = item.request.id
              const out = leftOut.has(id)
              const current = id === active.request.id
              return (
                <div
                  key={id}
                  className={cn(
                    "flex h-10 max-w-[260px] shrink-0 items-center rounded-(--pn-r-3) border pl-1",
                    current ? "border-(--pn-accent) bg-(--pn-accent-soft)" : "border-(--pn-line) bg-(--pn-surface)",
                    out && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    aria-current={current ? "page" : undefined}
                    onClick={() => open(id)}
                    className="flex h-full min-w-0 items-center gap-2 rounded-(--pn-r-2) px-2 text-left text-[13px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-(--pn-focus)/40"
                  >
                    {reviewed.has(id) && !out ? (
                      <Check aria-label="Checked" className="size-4 shrink-0 text-(--pn-accent)" />
                    ) : (
                      <span className="grid size-4 shrink-0 place-items-center text-[11px] text-(--pn-fg-muted) tabular-nums">
                        {index + 1}
                      </span>
                    )}
                    <span className={cn("truncate", out && "line-through")}>{item.request.title}</span>
                  </button>
                  {items.length > 1 && (
                    <IconButton
                      label={out ? `Sign ${item.request.title} too` : `Leave ${item.request.title} out`}
                      icon={out ? Plus : X}
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
        <div className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <DocumentViewer
              key={active.request.id}
              item={active}
              me={me}
              places={places}
              onMove={(next) => setMoved((current) => new Map(current).set(active.request.id, next))}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {more > 0 && (
              <InlineAlert tone="info">
                {pluralize(more, "more document")} {more === 1 ? "is" : "are"} waiting: sign these first, then come back
                for the rest.
              </InlineAlert>
            )}
            <SectionCard>
              <div className="flex flex-col gap-2">
                <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em] text-balance">
                  {active.request.title}
                </h1>
                <p className="text-[13px] text-(--pn-fg-muted)">
                  Requested by {active.request.createdByName} on {formatDateTime(new Date(active.request.createdAt))}
                </p>
                {signer && (
                  <p className="text-[14px] text-pretty">
                    {signer.role ? `As ${signer.role}, you sign` : "You sign"}{" "}
                    {places.length > 1
                      ? `in ${places.length} places: ${kindsLabel(places)} on ${pagesLabel(places)}.`
                      : `on ${pagesLabel(places)}.`}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 self-start"
                  nativeButton={false}
                  render={<Link to="/dashboard/esign/requests/$requestId" params={{ requestId: active.request.id }} />}
                >
                  <ExternalLink aria-hidden /> Open the request
                </Button>
              </div>
            </SectionCard>
            {leftOut.has(active.request.id) ? (
              <InlineAlert
                tone="warning"
                action={
                  <Button variant="outline" size="sm" onClick={() => toggle(active.request.id)}>
                    <Plus aria-hidden /> Sign it too
                  </Button>
                }
              >
                Left out: this document isn't signed now.
              </InlineAlert>
            ) : (
              <SectionCard title="Before you sign">
                <p className="text-[14px] text-pretty text-(--pn-fg-muted)">
                  {unchecked.length > 0
                    ? `Check where you sign in each document, moving the blue boxes if needed. ${pluralize(unchecked.length, "document")} left to check.`
                    : included.length === 1
                      ? "Choose Sign with CIE at the top. You need the card, its PIN and the NFC reader."
                      : `All ${included.length} documents checked. Choose Sign at the top: one PIN signs them all. You need the card and the NFC reader.`}
                </p>
                {active.signingNow && active.signingNow.sub !== me && (
                  <InlineAlert tone="warning" className="mt-3">
                    {active.signingNow.name} is signing this document right now. Leave it out or try again later.
                  </InlineAlert>
                )}
              </SectionCard>
            )}
          </div>
        </div>
      </PageContent>
    </>
  )
}

function DocumentViewer({
  item,
  me,
  places,
  onMove,
}: {
  item: Item
  me: string
  places: Place[]
  onMove: (places: Place[]) => void
}) {
  const contentFn = useServerFn(getEsignDocumentContent)
  const [base64, setBase64] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bytes = usePdfBytes(base64)
  const { request } = item

  useEffect(() => {
    if (!item.currentDocumentId) return
    let cancelled = false
    contentFn({ data: { documentId: item.currentDocumentId } })
      .then((result) => {
        if (!cancelled) setBase64(result.base64)
      })
      .catch((cause) => {
        console.error(cause)
        if (!cancelled) setError("Couldn't load the PDF.")
      })
    return () => {
      cancelled = true
    }
  }, [item.currentDocumentId, contentFn])

  const mine = request.signers.find((s) => s.sub === me && s.status === "pending")
  const first = mine ? placesLeft(places, mine.signaturesDone)[0] : undefined
  if (error) return <InlineAlert>{error}</InlineAlert>
  return (
    <PdfViewer
      data={bytes}
      pages={item.pdf?.pages ?? []}
      focus={first ? { page: first.page, y: first.y + first.height / 2 } : null}
      className="h-[calc(100dvh-250px)] min-h-[480px]"
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
                number={request.signers.length > 1 ? index + 1 : undefined}
                kind={place.kind}
                state={isMine ? "active" : "pending"}
                editable={isMine && signer.signaturesDone === 0}
                onChange={(next) => onMove(places.map((p, at) => (at === place.at ? { ...next, kind: p.kind } : p)))}
              />
            ))
        })
      }
    />
  )
}
