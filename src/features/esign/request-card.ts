import type { EsignRequestDetail } from "@/lib/api/types"

import { formatWhen } from "../../lib/format.ts"
import { MAX_BATCH } from "./agent.ts"
import { type Place, pagesShort, placesLeft } from "./places.ts"
import type { SigningDevice } from "./signing-device.ts"

type Request = EsignRequestDetail["request"]
type Signer = Request["signers"][number]

/** What the request page's action card reads. */
export type CardDetail = {
  request: Request
  events: {
    type: string
    at: Date | string
    actorSub: string | null
    data: { sub?: string; name?: string; reason?: string | null }
  }[]
  signingNow: { sub: string; name: string } | null
  /** Other documents waiting for the viewer's signature, in inbox order. */
  waiting: { count: number; next: { id: string; title: string } | null }
  config: { drives: { id: string; label: string }[] }
}

export type CardOptions = {
  me: string
  canManage: boolean
  device: SigningDevice
  /** PoliNetwork eSign has answered in this browser before. */
  knownBrowser: boolean
  now: Date
  /** The viewer's boxes as they dragged them, when they may still move. */
  places?: Place[]
}

export type CardTone = "neutral" | "brand" | "success" | "warning" | "danger"

/** A delivery step of a completed request: its words change in place as it settles. */
export type DeliveryLine =
  | { kind: "folder"; pending: boolean; text: string; file: string; href: string | null }
  | { kind: "email"; pending: boolean; text: string }

export type CardPrimary = { kind: "sign" } | { kind: "next"; id: string; title: string } | { kind: "sendAgain" }

export type RequestCard = {
  badge: { tone: CardTone; label: string }
  meta: string | null
  /** The sentence under the status line; null on phones, where `note` takes its place. */
  body: string | null
  /** Replaces the signing controls on phones and tablets; set together with them while the device is unknown. */
  note: string | null
  delivery: DeliveryLine[]
  /** Why the delivery failed, for the danger alert. */
  failure: string | null
  retry: boolean
  /** "ready": the viewer has what they need; "setup": this browser hasn't run PoliNetwork eSign yet. */
  muted: "ready" | "setup" | null
  lock: string | null
  primary: CardPrimary | null
  /** How many documents "Sign n together" signs, this one included. */
  signTogether: number | null
  /** The card's one red button. */
  danger: "decline" | "cancel" | "delete" | null
  /** Whose email note the body already gives, so their Signers row leaves it out. */
  notedSub: string | null
  /** The body says "we're emailing them": reload until the email is sent or the window ends. */
  emailing: boolean
}

export const PHONE_NOTE =
  "Signing needs your computer with the card reader and PoliNetwork eSign. This document will be waiting in To sign."

/** "Next to sign" follows a signature for this long. */
const JUST_SIGNED_MS = 10 * 60_000
/** How long after a signature the next signer's email counts as on its way. */
const EMAILING_MS = 20_000

/** "Mario Rossi", "Mario Rossi and Anna Bianchi", "Mario Rossi and 2 more". */
export function namesText(names: string[]) {
  if (names.length <= 2) return names.join(" and ")
  return `${names[0]} and ${names.length - 1} more`
}

const time = (value: Date | string) => new Date(value).getTime()

/** The request has been completed and its delivery (OneDrive, email) hasn't settled yet. */
export function isDelivering(request: Request) {
  const planned = request.output !== null || (request.email?.to.length ?? 0) > 0
  return request.status === "completed" && planned && (request.delivery?.status ?? "pending") === "pending"
}

/** The status badge of a request, as in lists. */
export function requestBadge(request: Pick<Request, "status" | "myTurn" | "delivery">): RequestCard["badge"] {
  if (request.status === "in_progress")
    return request.myTurn ? { tone: "brand", label: "Your turn" } : { tone: "warning", label: "In progress" }
  if (request.status === "completed")
    return request.delivery?.status === "failed"
      ? { tone: "danger", label: "Delivery failed" }
      : { tone: "success", label: "Signed" }
  if (request.status === "declined") return { tone: "danger", label: "Declined" }
  return { tone: "neutral", label: "Cancelled" }
}

/** The last email event about `sub` being their turn: sent, or why it couldn't be. */
function notice(events: CardDetail["events"], sub: string) {
  return events.findLast((e) => (e.type === "notified" || e.type === "notify_failed") && e.data.sub === sub)
}

function deliveryLines(detail: CardDetail): DeliveryLine[] {
  const { request, events } = detail
  const delivery = request.delivery
  const pending = isDelivering(request)
  const lines: DeliveryLine[] = []
  if (request.output) {
    const drive = detail.config.drives.find((d) => d.id === request.output?.driveId)?.label ?? "OneDrive"
    // Recorded right after the upload, before the delivery itself is saved.
    const uploaded = events.findLast((e) => e.type === "uploaded")
    const saving = pending && !delivery?.driveItem && !uploaded
    const name = delivery?.driveItem?.name ?? uploaded?.data.name ?? request.output.fileName
    lines.push({
      kind: "folder",
      pending: saving,
      text: `${saving ? "Saving" : "Saved"} to ${drive}: `,
      file: request.output.folderPath ? `${request.output.folderPath}/${name}` : name,
      href: delivery?.driveItem?.webUrl ?? null,
    })
  }
  if (request.email?.to.length) {
    const sending = pending && (delivery?.emailedTo.length ?? 0) === 0
    lines.push({
      kind: "email",
      pending: sending,
      text: `${sending ? "Sending" : "Emailed"} to ${request.email.to.join(", ")}`,
    })
  }
  return lines
}

/**
 * The request page's action card: status, the one sentence that says where things stand, and the actions the viewer
 * can take from here. Pure, so every state is unit-tested (tests/esign-request-card.test.mjs).
 */
export function requestCardState(detail: CardDetail, options: CardOptions): RequestCard {
  const { request, events, waiting } = detail
  const { me, canManage, device, now } = options
  const names = new Map(request.signers.map((s) => [s.sub, s.name]))
  names.set(request.createdBySub, request.createdByName)
  const mine = request.signers.find((s) => s.sub === me)
  const pending = mine?.status === "pending" ? mine : undefined
  const signs = device !== "phone"
  const note = device === "computer" ? null : PHONE_NOTE
  const progress = request.signers.length > 1 ? `${request.signedCount} of ${request.signers.length} signed` : null
  const holders = request.signers.filter((s) => request.turn.includes(s.sub) && s.sub !== me)
  const justSigned = mine?.signedAt != null && now.getTime() - time(mine.signedAt) < JUST_SIGNED_MS
  const next: CardPrimary | null =
    justSigned && signs && waiting.next ? { kind: "next", id: waiting.next.id, title: waiting.next.title } : null

  const card: RequestCard = {
    badge: requestBadge(request),
    meta: null,
    body: null,
    note: null,
    delivery: [],
    failure: null,
    retry: false,
    muted: null,
    lock: null,
    primary: null,
    signTogether: null,
    danger: null,
    notedSub: null,
    emailing: false,
  }

  if (request.status === "in_progress") {
    card.meta = progress
    card.danger =
      request.createdBySub === me && canManage ? "cancel" : pending ? "decline" : canManage ? "cancel" : null

    if (pending && request.myTurn) return yourTurn(card, pending, detail, options, note)

    if (pending) {
      const ahead = request.signers
        .filter((s) => s.status === "pending" && !request.turn.includes(s.sub))
        .sort((a, b) => a.position - b.position)
      const waitingFor = namesText(holders.map((s) => s.name))
      card.body = ahead[0]?.sub === me ? `Waiting for ${waitingFor}, then you.` : `Waiting for ${waitingFor}.`
      return card
    }

    if (mine?.status === "signed" && mine.signedAt) {
      const signedAt = time(mine.signedAt)
      let clause = ` Waiting for ${namesText(holders.map((s) => s.name))}.`
      // Unordered signers were all emailed when the request was created: their rows say when.
      if (request.ordered && holders.length === 1) {
        const holder = holders[0]
        const sent = notice(events, holder.sub)
        card.notedSub = holder.sub
        card.emailing = !sent && now.getTime() - signedAt < EMAILING_MS
        clause =
          sent?.type === "notified"
            ? ` ${holder.name} signs next; we emailed them.`
            : sent
              ? ` ${holder.name} signs next, but we couldn't email them.`
              : card.emailing
                ? ` ${holder.name} signs next; we're emailing them.`
                : ` ${holder.name} signs next.`
      }
      card.body = `You signed ${formatWhen(new Date(signedAt), now)}.${clause}`
      card.primary = next
      return card
    }

    let clause = ""
    if (holders.length === 1) {
      const sent = notice(events, holders[0].sub)
      card.notedSub = holders[0].sub
      if (sent?.type === "notified") clause = ` We emailed them ${formatWhen(new Date(sent.at), now)}.`
      else if (sent)
        clause =
          sent.data.reason === "no_email" ? " We couldn't email them: no email address." : " We couldn't email them."
    }
    card.body = `Waiting for ${namesText(holders.map((s) => s.name))}.${clause}`
    return card
  }

  if (request.status === "completed") {
    const [only] = request.signers
    const signedAt = only?.signedAt ?? request.completedAt
    const when = signedAt ? ` ${formatWhen(new Date(signedAt), now)}` : ""
    card.body =
      request.signers.length > 1
        ? "Everyone has signed."
        : only?.sub === me
          ? `You signed${when}.`
          : `${only?.name ?? "The signer"} signed${when}.`
    if (request.delivery?.status === "failed") {
      card.failure = request.delivery.error ?? "The document couldn't be delivered."
      card.retry = canManage
      return card
    }
    card.delivery = deliveryLines(detail)
    card.primary = next
    return card
  }

  if (request.status === "declined") {
    const decliner = request.signers.find((s) => s.status === "declined")
    const who = decliner?.sub === me ? "You" : (decliner?.name ?? "A signer")
    card.body = decliner?.declineReason ? `${who} declined: “${decliner.declineReason}”` : `${who} declined.`
  } else {
    const cancelled = events.findLast((e) => e.type === "cancelled")
    const actor = cancelled?.actorSub ?? null
    const who = (actor && names.get(actor)) || cancelled?.data.name
    card.body =
      actor === me ? "You cancelled the request." : who ? `${who} cancelled the request.` : "The request was cancelled."
  }
  if (canManage) {
    card.primary = { kind: "sendAgain" }
    card.danger = "delete"
  }
  return card
}

function yourTurn(
  card: RequestCard,
  mine: Signer,
  detail: CardDetail,
  options: CardOptions,
  note: string | null
): RequestCard {
  const places = options.places ?? mine.places
  card.meta = [mine.role, places.length > 0 && pagesShort(places)].filter(Boolean).join(" · ")
  card.note = note
  if (options.device === "phone") return card
  const done = mine.signaturesDone
  const several = places.length > 1
  card.body =
    done > 0
      ? `${done} of ${places.filter((p) => p.kind === "signature").length} signatures done. Sign with CIE to finish.`
      : several
        ? "Check the blue boxes, then sign with CIE."
        : "Check the blue box, then sign with CIE."
  const holder = detail.signingNow
  // One line, like the muted line it replaces, so the card keeps its height when the lock comes and goes. The disabled
  // Sign with CIE says the rest.
  card.lock = holder && holder.sub !== options.me ? `${holder.name} is signing right now.` : null
  card.muted = card.lock || done > 0 ? null : options.knownBrowser ? "ready" : "setup"
  card.primary = { kind: "sign" }
  card.signTogether = detail.waiting.count > 0 ? Math.min(detail.waiting.count + 1, MAX_BATCH) : null
  return card
}

/**
 * Where the viewer opens, from the first data the page gets: the viewer's first box still to sign, else the spot they
 * just signed, else the first box of whoever's turn it is; null for the top of page 1.
 */
export function openPoint(request: Request, me: string, now: Date): { page: number; y: number } | null {
  const center = (place: Place) => ({ page: place.page, y: place.y + place.height / 2 })
  const mine = request.signers.find((s) => s.sub === me)
  const active = request.status === "in_progress"
  if (active && request.myTurn && mine?.status === "pending") {
    const first = placesLeft(mine.places, mine.signaturesDone)[0]
    if (first) return center(first)
  }
  if (mine?.signedAt != null && now.getTime() - time(mine.signedAt) < JUST_SIGNED_MS && mine.places[0])
    return center(mine.places[0])
  const holder = active ? request.signers.find((s) => request.turn.includes(s.sub)) : undefined
  const first = holder && placesLeft(holder.places, holder.signaturesDone)[0]
  return first ? center(first) : null
}
