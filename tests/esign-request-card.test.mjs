import assert from "node:assert/strict"
import test from "node:test"

import { pagesShort } from "../src/features/esign/places.ts"
import { namesText, openPoint, PHONE_NOTE, requestCardState } from "../src/features/esign/request-card.ts"
import { formatWhen } from "../src/lib/format.ts"

const ME = "me"
const MARIO = "mario"
const ANNA = "anna"
const LUCA = "luca"
const NAMES = { [ME]: "Preview Agent", [MARIO]: "Mario Rossi", [ANNA]: "Anna Bianchi", [LUCA]: "Luca Verdi" }

// 10:30 in Rome.
const NOW = new Date("2026-10-21T08:30:00Z")
// 10:25 in Rome, five minutes before NOW.
const SIGNED_AT = "2026-10-21T08:25:00Z"

const box = (page = 0, kind = "signature") => ({ kind, page, x: 0.1, y: 0.5, width: 0.3, height: 0.08 })

function signer(sub, position, over = {}) {
  return {
    id: `${sub}-id`,
    sub,
    name: NAMES[sub],
    role: null,
    status: "pending",
    position,
    places: [box()],
    signaturesDone: 0,
    signedAt: null,
    declineReason: null,
    ...over,
  }
}

function detail({ request = {}, events = [], signingNow = null, waiting = { count: 0, next: null } } = {}) {
  const signers = request.signers ?? []
  return {
    request: {
      id: "request",
      title: "Verbale",
      status: "in_progress",
      myTurn: false,
      ordered: false,
      turn: [],
      signedCount: signers.filter((s) => s.status === "signed").length,
      createdBySub: ME,
      createdByName: NAMES[ME],
      output: null,
      email: null,
      delivery: null,
      completedAt: null,
      ...request,
      signers,
    },
    events,
    signingNow,
    waiting,
    config: { drives: [{ id: "drive", label: "OneDrive Verbali" }] },
  }
}

function notified(sub, at, type = "notified", reason = null) {
  const data = { sub }
  if (reason) data.reason = reason
  return { type, at, actorSub: null, data }
}

function card(d, options = {}) {
  return requestCardState(d, { me: ME, canManage: true, device: "computer", knownBrowser: true, now: NOW, ...options })
}

/** The card's strings and actions, without the bookkeeping fields. */
function view(c) {
  return {
    badge: c.badge.label,
    meta: c.meta,
    body: c.body,
    note: c.note,
    muted: c.muted,
    lock: c.lock,
    primary: c.primary && (c.primary.kind === "next" ? `next:${c.primary.title}` : c.primary.kind),
    together: c.signTogether,
    danger: c.danger,
  }
}

const unorderedTwo = (over = {}) =>
  detail({
    request: {
      myTurn: true,
      turn: [ME, MARIO],
      signers: [signer(ME, 0, { role: "Segretario" }), signer(MARIO, 1, { role: "Presidente" })],
    },
    waiting: { count: 4, next: { id: "next", title: "Verbale 2" } },
    ...over,
  })

void test("your turn: the box to check, the PIN line or the setup link, Sign with CIE", () => {
  assert.deepEqual(view(card(unorderedTwo())), {
    badge: "Your turn",
    meta: "Segretario · p. 1",
    body: "Check the blue box, then sign with CIE.",
    note: null,
    muted: "ready",
    lock: null,
    primary: "sign",
    together: 5,
    danger: "cancel",
  })
  assert.equal(card(unorderedTwo(), { knownBrowser: false }).muted, "setup")

  // Several places, no role, boxes dragged to page 3.
  const d = unorderedTwo()
  d.request.signers[0] = signer(ME, 0, { places: [box(0), box(2, "mark")] })
  assert.equal(card(d).body, "Check the blue boxes, then sign with CIE.")
  assert.equal(card(d).meta, "p. 1 and 3")
  assert.equal(card(d, { places: [box(2), box(2, "mark")] }).meta, "p. 3")

  // "Sign n together" counts this document and signs at most 10.
  assert.equal(card(unorderedTwo({ waiting: { count: 20, next: null } })).signTogether, 10)
  assert.equal(card(unorderedTwo({ waiting: { count: 0, next: null } })).signTogether, null)
})

void test("your turn, partly signed: how many signatures are done", () => {
  const d = unorderedTwo()
  d.request.signers[0] = signer(ME, 0, { role: "Segretario", places: [box(0), box(2)], signaturesDone: 1 })
  assert.deepEqual(view(card(d)), {
    ...view(card(unorderedTwo())),
    meta: "Segretario · p. 1 and 3",
    body: "1 of 2 signatures done. Sign with CIE to finish.",
    muted: null,
  })
})

void test("your turn while someone else signs: the lock line and a disabled Sign", () => {
  const locked = card(unorderedTwo({ signingNow: { sub: MARIO, name: "Mario Rossi" } }))
  assert.equal(locked.lock, "Mario Rossi is signing right now.")
  assert.equal(locked.muted, null)
  assert.deepEqual(locked.primary, { kind: "sign" })
  // The viewer's own lock, from another tab, isn't someone else's.
  assert.equal(card(unorderedTwo({ signingNow: { sub: ME, name: NAMES[ME] } })).lock, null)
})

void test("on a phone the note replaces every way to sign; before hydration both render", () => {
  const partly = unorderedTwo()
  partly.request.signers[0] = signer(ME, 0, { role: "Segretario", places: [box(0), box(2)], signaturesDone: 1 })
  const locked = unorderedTwo({ signingNow: { sub: MARIO, name: "Mario Rossi" } })
  for (const d of [unorderedTwo(), partly, locked]) {
    const phone = view(card(d, { device: "phone" }))
    assert.deepEqual(
      { ...phone, meta: undefined },
      {
        badge: "Your turn",
        meta: undefined,
        body: null,
        note: PHONE_NOTE,
        muted: null,
        lock: null,
        primary: null,
        together: null,
        danger: "cancel",
      }
    )
    const unknown = card(d, { device: "unknown" })
    assert.equal(unknown.note, PHONE_NOTE)
    assert.notEqual(unknown.body, null)
    assert.deepEqual(unknown.primary, { kind: "sign" })
  }
  assert.equal(
    PHONE_NOTE,
    "Signing needs your computer with the card reader and PoliNetwork eSign. This document will be waiting in To sign."
  )
})

void test("your turn is later: whom it waits for, and no primary", () => {
  const d = detail({
    request: { ordered: true, turn: [MARIO], signers: [signer(MARIO, 0), signer(ME, 1)] },
  })
  assert.deepEqual(view(card(d)), {
    badge: "In progress",
    meta: "0 of 2 signed",
    body: "Waiting for Mario Rossi, then you.",
    note: null,
    muted: null,
    lock: null,
    primary: null,
    together: null,
    danger: "cancel",
  })
  // An invitee declines, even before their turn.
  assert.equal(card({ ...d, request: { ...d.request, createdBySub: LUCA } }).danger, "decline")

  const third = detail({
    request: { ordered: true, turn: [MARIO], signers: [signer(MARIO, 0), signer(ANNA, 1), signer(ME, 2)] },
  })
  assert.equal(card(third).body, "Waiting for Mario Rossi.")
})

void test("you don't sign: whom it waits for and, for one person, whether they were emailed", () => {
  const one = (events) => detail({ request: { ordered: true, turn: [MARIO], signers: [signer(MARIO, 0)] }, events })
  assert.deepEqual(view(card(one([notified(MARIO, "2026-10-21T07:00:00Z")]))), {
    badge: "In progress",
    meta: null,
    body: "Waiting for Mario Rossi. We emailed them at 09:00.",
    note: null,
    muted: null,
    lock: null,
    primary: null,
    together: null,
    danger: "cancel",
  })
  assert.equal(card(one([notified(MARIO, "2026-10-21T07:00:00Z")])).notedSub, MARIO)
  assert.equal(
    card(one([notified(MARIO, "2026-10-20T08:00:00Z")])).body,
    "Waiting for Mario Rossi. We emailed them on 20 Oct 2026."
  )
  assert.equal(
    card(one([notified(MARIO, NOW.toISOString(), "notify_failed", "no_email")])).body,
    "Waiting for Mario Rossi. We couldn't email them: no email address."
  )
  assert.equal(
    card(one([notified(MARIO, NOW.toISOString(), "notify_failed", "send_failed")])).body,
    "Waiting for Mario Rossi. We couldn't email them."
  )
  assert.equal(card(one([])).body, "Waiting for Mario Rossi.")

  // Several turns open: the names, and the email notes stay on the Signers rows.
  const many = detail({
    request: {
      turn: [MARIO, ANNA, LUCA],
      signers: [signer(MARIO, 0), signer(ANNA, 1), signer(LUCA, 2)],
    },
    events: [notified(MARIO, "2026-10-21T08:00:00Z")],
  })
  assert.equal(card(many).body, "Waiting for Mario Rossi and 2 more.")
  assert.equal(card(many).notedSub, null)
  assert.equal(card(many).meta, "0 of 3 signed")
})

void test("you signed, others still to sign: when, and what happens next", () => {
  const ordered = (events, now = NOW) =>
    card(
      detail({
        request: {
          ordered: true,
          turn: [MARIO],
          signers: [signer(ME, 0, { status: "signed", signedAt: SIGNED_AT }), signer(MARIO, 1)],
        },
        events,
        waiting: { count: 1, next: { id: "next", title: "Verbale 2" } },
      }),
      { now }
    )
  assert.deepEqual(view(ordered([notified(MARIO, SIGNED_AT)])), {
    badge: "In progress",
    meta: "1 of 2 signed",
    body: "You signed at 10:25. Mario Rossi signs next; we emailed them.",
    note: null,
    muted: null,
    lock: null,
    primary: "next:Verbale 2",
    together: null,
    danger: "cancel",
  })
  assert.equal(ordered([notified(MARIO, SIGNED_AT)]).notedSub, MARIO)
  assert.equal(
    ordered([notified(MARIO, SIGNED_AT, "notify_failed", "no_email")]).body,
    "You signed at 10:25. Mario Rossi signs next, but we couldn't email them."
  )

  // The email goes out right after the signature: the card says it's on its way and the page follows it.
  const justNow = ordered([], new Date(new Date(SIGNED_AT).getTime() + 5000))
  assert.equal(justNow.body, "You signed at 10:25. Mario Rossi signs next; we're emailing them.")
  assert.equal(justNow.emailing, true)
  const late = ordered([])
  assert.equal(late.body, "You signed at 10:25. Mario Rossi signs next.")
  assert.equal(late.emailing, false)

  // "Next to sign" only for a while after signing, and never on a phone.
  assert.equal(ordered([], new Date("2026-10-21T09:00:00Z")).primary, null)
  const phone = requestCardState(
    detail({
      request: {
        ordered: true,
        turn: [MARIO],
        signers: [signer(ME, 0, { status: "signed", signedAt: SIGNED_AT }), signer(MARIO, 1)],
      },
      waiting: { count: 1, next: { id: "next", title: "Verbale 2" } },
    }),
    { me: ME, canManage: true, device: "phone", knownBrowser: true, now: NOW }
  )
  assert.equal(phone.primary, null)

  const unordered = card(
    detail({
      request: {
        turn: [MARIO, ANNA],
        signers: [signer(ME, 0, { status: "signed", signedAt: SIGNED_AT }), signer(MARIO, 1), signer(ANNA, 2)],
      },
      events: [notified(MARIO, SIGNED_AT)],
    })
  )
  assert.equal(unordered.body, "You signed at 10:25. Waiting for Mario Rossi and Anna Bianchi.")
  assert.equal(unordered.notedSub, null)
  assert.equal(unordered.primary, null)
})

const completed = (signers, over = {}) =>
  detail({
    request: {
      status: "completed",
      completedAt: SIGNED_AT,
      signers,
      output: { driveId: "drive", folderPath: "Verbali", fileName: "Verbale - firmato.pdf" },
      email: { to: ["segreteria@example.org"] },
      delivery: { status: "pending", error: null, driveItem: null, emailedTo: [] },
      ...over,
    },
    waiting: { count: 1, next: { id: "next", title: "Verbale 2" } },
  })
const signedMe = signer(ME, 0, { status: "signed", signedAt: SIGNED_AT })

void test("completed and delivering: who signed, then each delivery line changing in place", () => {
  const c = card(completed([signedMe]))
  assert.deepEqual(view(c), {
    badge: "Signed",
    meta: null,
    body: "You signed at 10:25.",
    note: null,
    muted: null,
    lock: null,
    primary: "next:Verbale 2",
    together: null,
    danger: null,
  })
  assert.deepEqual(c.delivery, [
    {
      kind: "folder",
      pending: true,
      text: "Saving to OneDrive Verbali: ",
      file: "Verbali/Verbale - firmato.pdf",
      href: null,
    },
    { kind: "email", pending: true, text: "Sending to segreteria@example.org" },
  ])

  assert.equal(
    card(completed([signer(MARIO, 0, { status: "signed", signedAt: SIGNED_AT })])).body,
    "Mario Rossi signed at 10:25."
  )
  assert.equal(
    card(completed([signedMe, signer(MARIO, 1, { status: "signed", signedAt: SIGNED_AT })])).body,
    "Everyone has signed."
  )
})

void test("completed and delivered: Saved to with the OneDrive link, Emailed to", () => {
  const c = card(
    completed([signedMe], {
      delivery: {
        status: "delivered",
        error: null,
        driveItem: { name: "Verbale - firmato (1).pdf", webUrl: "https://onedrive.example/item" },
        emailedTo: ["segreteria@example.org"],
      },
    })
  )
  assert.deepEqual(c.delivery, [
    {
      kind: "folder",
      pending: false,
      text: "Saved to OneDrive Verbali: ",
      file: "Verbali/Verbale - firmato (1).pdf",
      href: "https://onedrive.example/item",
    },
    { kind: "email", pending: false, text: "Emailed to segreteria@example.org" },
  ])
  assert.equal(c.body, "You signed at 10:25.")
})

void test("completed with nothing to deliver: the sentence only", () => {
  const c = card(completed([signedMe], { output: null, email: null, delivery: null }), {
    now: new Date("2026-10-22T08:30:00Z"),
  })
  assert.deepEqual(view(c), {
    badge: "Signed",
    meta: null,
    body: "You signed on 21 Oct 2026.",
    note: null,
    muted: null,
    lock: null,
    primary: null,
    together: null,
    danger: null,
  })
  assert.deepEqual(c.delivery, [])
})

void test("delivery failed: the error, and Retry for managers", () => {
  const failed = completed([signedMe], {
    delivery: { status: "failed", error: "The folder no longer exists.", driveItem: null, emailedTo: [] },
  })
  const c = card(failed)
  assert.equal(c.badge.label, "Delivery failed")
  assert.equal(c.body, "You signed at 10:25.")
  assert.equal(c.failure, "The folder no longer exists.")
  assert.equal(c.retry, true)
  assert.equal(c.primary, null)
  assert.deepEqual(c.delivery, [])
  assert.equal(card(failed, { canManage: false }).retry, false)
  failed.request.delivery.error = null
  assert.equal(card(failed).failure, "The document couldn't be delivered.")
})

void test("declined: who declined and why; Send again and Delete for managers", () => {
  const declined = (sub, reason) =>
    detail({
      request: {
        status: "declined",
        signers: [signer(sub, 0, { status: "declined", declineReason: reason }), signer(ANNA, 1)],
      },
    })
  assert.deepEqual(view(card(declined(MARIO, "Wrong date"))), {
    badge: "Declined",
    meta: null,
    body: "Mario Rossi declined: “Wrong date”",
    note: null,
    muted: null,
    lock: null,
    primary: "sendAgain",
    together: null,
    danger: "delete",
  })
  assert.equal(card(declined(MARIO, null)).body, "Mario Rossi declined.")
  assert.equal(card(declined(ME, "Wrong date")).body, "You declined: “Wrong date”")
  assert.equal(card(declined(ME, null)).body, "You declined.")
  const viewer = card(declined(MARIO, null), { canManage: false })
  assert.equal(viewer.primary, null)
  assert.equal(viewer.danger, null)
})

void test("cancelled: who cancelled; Send again and Delete for managers", () => {
  const cancelled = (actorSub, data = {}) =>
    detail({
      request: { status: "cancelled", signers: [signer(MARIO, 0), signer(ANNA, 1)] },
      events: actorSub === undefined ? [] : [{ type: "cancelled", at: SIGNED_AT, actorSub, data }],
    })
  assert.deepEqual(view(card(cancelled(ME))), {
    badge: "Cancelled",
    meta: null,
    body: "You cancelled the request.",
    note: null,
    muted: null,
    lock: null,
    primary: "sendAgain",
    together: null,
    danger: "delete",
  })
  assert.equal(card(cancelled(MARIO)).body, "Mario Rossi cancelled the request.")
  assert.equal(card(cancelled(LUCA, { name: "Luca Verdi" })).body, "Luca Verdi cancelled the request.")
  assert.equal(card(cancelled(undefined)).body, "The request was cancelled.")
})

void test("the one red button: Cancel for the creator who manages, Decline for a pending signer", () => {
  const request = (createdBySub, mine) =>
    detail({
      request: {
        createdBySub,
        createdByName: NAMES[createdBySub],
        ordered: true,
        turn: [MARIO],
        signers: [signer(MARIO, 0), ...(mine ? [signer(ME, 1, mine)] : [])],
      },
    })
  const danger = (d, canManage) => card(d, { canManage }).danger
  // Creator who can manage, even as a pending signer.
  assert.equal(danger(request(ME, {}), true), "cancel")
  // Creator without the permission, invitee: a pending signer declines.
  assert.equal(danger(request(ME, {}), false), "decline")
  assert.equal(danger(request(ANNA, {}), false), "decline")
  assert.equal(danger(request(ANNA, {}), true), "decline")
  // A manager who doesn't sign, or already signed, cancels; a plain viewer has none.
  assert.equal(danger(request(ANNA, null), true), "cancel")
  assert.equal(danger(request(ANNA, { status: "signed", signedAt: SIGNED_AT }), true), "cancel")
  assert.equal(danger(request(ANNA, null), false), null)
  assert.equal(danger(request(ANNA, { status: "signed", signedAt: SIGNED_AT }), false), null)
})

void test("a lone signer's meta never reads 0 of 1 signed", () => {
  const d = detail({ request: { ordered: true, turn: [MARIO], signers: [signer(MARIO, 0)] } })
  assert.equal(card(d).meta, null)
})

void test("the viewer opens on the spot that matters", () => {
  const at = (place) => ({ page: place.page, y: place.y + place.height / 2 })
  const mine = box(2)
  const yourTurn = unorderedTwo().request
  yourTurn.signers[0] = signer(ME, 0, { places: [mine] })
  assert.deepEqual(openPoint(yourTurn, ME, NOW), at(mine))

  const signed = detail({
    request: {
      ordered: true,
      turn: [MARIO],
      signers: [signer(ME, 0, { status: "signed", signedAt: SIGNED_AT, places: [box(1)] }), signer(MARIO, 1)],
    },
  }).request
  assert.deepEqual(openPoint(signed, ME, NOW), at(box(1)))
  // Long after signing, the turn holder's box.
  assert.deepEqual(openPoint(signed, ME, new Date("2026-10-21T12:00:00Z")), at(box(0)))
  assert.equal(openPoint(completed([signer(MARIO, 0, { status: "signed" })]).request, ME, NOW), null)
})

void test("copy helpers", () => {
  assert.equal(namesText(["Mario Rossi"]), "Mario Rossi")
  assert.equal(namesText(["Mario Rossi", "Anna Bianchi"]), "Mario Rossi and Anna Bianchi")
  assert.equal(namesText(["Mario Rossi", "Anna Bianchi", "Luca Verdi"]), "Mario Rossi and 2 more")
  assert.equal(pagesShort([box(0)]), "p. 1")
  assert.equal(pagesShort([box(2), box(0)]), "p. 1 and 3")
  assert.equal(pagesShort([box(0), box(1), box(3), box(1)]), "p. 1, 2 and 4")
  assert.equal(formatWhen(new Date(SIGNED_AT), NOW), "at 10:25")
  // Past midnight in Rome, still the 21st in UTC.
  assert.equal(formatWhen(new Date("2026-10-21T22:30:00Z"), new Date("2026-10-21T21:00:00Z")), "on 22 Oct 2026")
})
