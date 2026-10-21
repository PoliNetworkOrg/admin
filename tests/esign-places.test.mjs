import assert from "node:assert/strict"
import test from "node:test"

import { defaultPlace, findSpots, placeAt, placeRows, placeUnderRole, roleKey } from "../src/features/esign/places.ts"

const A4 = { width: 595, height: 842 }
const A4_LANDSCAPE = { width: 842, height: 595 }

void test("a moved place is centred on the click, on the clicked page, with its kind", () => {
  const mark = { kind: "mark", page: 1, x: 0.6, y: 0.8, width: 0.3, height: 0.1 }
  const moved = placeAt(mark, [A4, A4], 0, 0.5, 0.4)
  assert.equal(moved.kind, "mark")
  assert.equal(moved.page, 0)
  assert.ok(Math.abs(moved.width - 0.3) < 1e-9 && Math.abs(moved.height - 0.1) < 1e-9)
  assert.ok(Math.abs(moved.x - 0.35) < 1e-9 && Math.abs(moved.y - 0.35) < 1e-9)
})

void test("a place moved to a page of another size keeps its size in points", () => {
  const place = { kind: "signature", page: 0, x: 0.1, y: 0.1, width: 0.3, height: 0.08 }
  const moved = placeAt(place, [A4, A4_LANDSCAPE], 1, 0.5, 0.5)
  assert.ok(Math.abs(moved.width * A4_LANDSCAPE.width - 0.3 * A4.width) < 1e-9)
  assert.ok(Math.abs(moved.height * A4_LANDSCAPE.height - 0.08 * A4.height) < 1e-9)
})

void test("a click near the edge keeps the whole place on the page", () => {
  const place = { kind: "signature", page: 0, x: 0.1, y: 0.1, width: 0.3, height: 0.08 }
  const corner = placeAt(place, [A4], 0, 0.99, 0.01)
  assert.ok(Math.abs(corner.x - 0.7) < 1e-9)
  assert.equal(corner.y, 0)
})

/**
 * A text run as pdf.js reports it on an A4 page: x and the baseline in points from the top-left corner, the box from
 * the baseline up by the font size, about half the size per character.
 */
function run(text, x, baseline, { page = 0, size = 11, width } = {}) {
  return {
    page,
    text,
    x: x / A4.width,
    y: (baseline - size) / A4.height,
    width: (width ?? text.length * size * 0.5) / A4.width,
    height: size / A4.height,
  }
}

/** A paragraph of body text, one run per line, 15 pt apart. */
function paragraph(baseline, lines, { page = 0 } = {}) {
  return Array.from({ length: lines }, (_, i) =>
    run(`Riga ${i + 1} del verbale, con il testo della discussione e delle delibere.`, 72, baseline + i * 15, { page })
  )
}

/** The places in points, for readable assertions. */
const points = (p) => ({
  left: p.x * A4.width,
  right: (p.x + p.width) * A4.width,
  top: p.y * A4.height,
  bottom: (p.y + p.height) * A4.height,
})

/** Whether a box covers a run's glyphs (descenders included). Signature lines may be covered. */
function covers(place, anchor) {
  if (place.page !== anchor.page || /^[_.…\s]+$/.test(anchor.text)) return false
  const w = Math.min(place.x + place.width, anchor.x + anchor.width) - Math.max(place.x, anchor.x)
  const h = Math.min(place.y + place.height, anchor.y + anchor.height * 1.2) - Math.max(place.y, anchor.y)
  return w > 0 && h > 0
}

function overlapping(a, b) {
  return (
    a.page === b.page &&
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)
  )
}

function assertClear(places, anchors) {
  for (const place of places) {
    const covered = anchors.filter((a) => covers(place, a)).map((a) => a.text)
    assert.deepEqual(covered, [], `the box at ${JSON.stringify(points(place))} covers text`)
    assert.ok(place.x >= 0 && place.y >= 0 && place.x + place.width <= 1 && place.y + place.height <= 1)
  }
  for (const [i, a] of places.entries())
    for (const b of places.slice(i + 1)) assert.ok(!overlapping(a, b), "two boxes overlap")
}

void test("labels key by role: qualifiers make another role, articles and endings don't", () => {
  assert.deepEqual(roleKey("Il Presidente"), { key: "presidente", role: "Presidente" })
  for (const label of ["Il Vicepresidente", "Il Vice Presidente", "Il Vice-Presidente"])
    assert.equal(roleKey(label)?.key, "vicepresidente", label)
  assert.equal(roleKey("Firma del Presidente")?.key, "presidente")
  assert.deepEqual(roleKey("IL SEGRETARIO"), { key: "segretario", role: "SEGRETARIO" })
  assert.deepEqual(roleKey("Il Segretario verbalizzante"), { key: "segretario", role: "Segretario verbalizzante" })
  assert.equal(roleKey("Il Presidente apre la seduta"), null)
  assert.equal(roleKey("Copresidente")?.key, "copresidente")
  assert.equal(roleKey("Ex Presidente")?.key, "expresidente")
  assert.deepEqual(roleKey("La Segretaria:"), { key: "segretario", role: "Segretaria" })
  assert.equal(roleKey("Presidenza"), null)
})

void test("two labels side by side become two spots, left first, each box in its own column", () => {
  const body = paragraph(120, 6)
  const asTwoRuns = [...body, run("Il Segretario", 100, 300), run("Il Presidente", 390, 300)]
  const asOneRun = [...body, run(`Il Segretario${" ".repeat(40)}Il Presidente`, 100, 300, { width: 351 })]
  for (const anchors of [asTwoRuns, asOneRun]) {
    const spots = findSpots(anchors, [A4])
    assert.deepEqual(
      spots.map((s) => [s.key, s.role]),
      [
        ["segretario", "Segretario"],
        ["presidente", "Presidente"],
      ]
    )
    const [left, right] = spots.map((s) => points(s.places[0]))
    // The column boundary is halfway between the two labels.
    const boundary = (100 + 13 * 5.5 + 390) / 2
    assert.ok(left.right <= boundary && right.left >= boundary, JSON.stringify({ left, right, boundary }))
    assert.ok(left.top >= 300 && right.top >= 300, "under the labels")
    assertClear(
      spots.flatMap((s) => s.places),
      anchors
    )
  }
})

void test("Presidente and Vicepresidente are distinct spots whose boxes cover no text and no other box", () => {
  const anchors = [
    ...paragraph(120, 6),
    run("Il Presidente apre la seduta e la dichiara valida.", 72, 220),
    run("Il Vicepresidente", 72, 420),
    run("Il Presidente", 380, 420),
  ]
  const spots = findSpots(anchors, [A4])
  assert.deepEqual(
    spots.map((s) => s.key),
    ["vicepresidente", "presidente"]
  )
  assertClear(
    spots.flatMap((s) => s.places),
    anchors
  )
  // A typed role finds its own label, never the qualified one: each box stays on its label's side.
  const boundary = (72 + 17 * 5.5 + 380) / 2
  const presidente = placeUnderRole("Presidente", anchors, [A4], [])
  assert.ok(presidente && points(presidente).left >= boundary, JSON.stringify(presidente && points(presidente)))
  const vice = placeUnderRole("Vice Presidente", anchors, [A4], [])
  assert.ok(vice && points(vice).right <= boundary, JSON.stringify(vice && points(vice)))
})

void test("a label at the very bottom of the page gets its box above, without covering it", () => {
  const anchors = [...paragraph(120, 20), run("Il Presidente", 400, 800)]
  const [spot] = findSpots(anchors, [A4])
  const box = points(spot.places[0])
  assert.ok(box.bottom <= 800 - 11, JSON.stringify(box))
  assertClear(spot.places, anchors)
})

void test("a label followed by a name line gets its box below the name", () => {
  const anchors = [...paragraph(120, 6), run("Il Segretario", 100, 300), run("(Anna Bianchi)", 98, 314)]
  const [spot] = findSpots(anchors, [A4])
  assert.ok(points(spot.places[0]).top >= 314, JSON.stringify(points(spot.places[0])))
  assertClear(spot.places, anchors)
})

void test("a signature line under the label or beside it carries the box", () => {
  const under = [...paragraph(120, 6), run("Il Segretario", 100, 300), run("_".repeat(24), 80, 350)]
  const [below] = findSpots(under, [A4])
  const box = points(below.places[0])
  assert.ok(Math.abs(box.bottom - 351) < 2, JSON.stringify(box))
  assert.ok(box.top > 300, "the label stays clear")

  const beside = [...paragraph(120, 6), run(`Il Presidente ${"_".repeat(24)}`, 300, 420)]
  const [spot] = findSpots(beside, [A4])
  const onLine = points(spot.places[0])
  assert.ok(Math.abs(onLine.bottom - 421) < 2 && onLine.left >= 300 + 13 * 5.5, JSON.stringify(onLine))
  assert.equal(spot.role, "Presidente")
})

void test("the same label on two pages is one spot with a box on each", () => {
  const anchors = [
    ...paragraph(120, 6),
    run("Il Presidente", 380, 500),
    run("Allegato A", 72, 80, { page: 1 }),
    run("Il Segretario:", 72, 300, { page: 1 }),
    run("Il Presidente:", 380, 300, { page: 1 }),
  ]
  const spots = findSpots(anchors, [A4, A4])
  assert.deepEqual(
    spots.map((s) => [s.key, s.places.map((p) => p.page)]),
    [
      ["presidente", [0, 1]],
      ["segretario", [1]],
    ]
  )
  assert.ok(spots[0].places.every((p) => p.kind === "signature"))
})

void test("a role named twice on one page is two spots", () => {
  const anchors = [run("Il Socio", 72, 600), run("Il Socio", 380, 600)]
  assert.deepEqual(
    findSpots(anchors, [A4]).map((s) => s.id),
    ["socio-0", "socio-1"]
  )
})

void test("no labels, body text naming a role, or a table of roles make no spots", () => {
  assert.deepEqual(findSpots(paragraph(120, 30), [A4]), [])
  assert.deepEqual(findSpots([run("Il Presidente apre la seduta alle ore 18:00.", 72, 200)], [A4]), [])
  const table = [
    run("Mario Rossi", 90, 258),
    run("Presidente", 260, 258),
    run("presente", 420, 258),
    run("Luca Verdi", 90, 273),
    run("Tesoriere", 260, 273),
    run("assente", 420, 273),
  ]
  assert.deepEqual(findSpots(table, [A4]), [])
})

void test("a bare role on a line of its own, with room to sign, is a label", () => {
  const anchors = [...paragraph(120, 6), run("Segretario", 100, 400), run("Presidente", 390, 400)]
  assert.deepEqual(
    findSpots(anchors, [A4]).map((s) => s.key),
    ["segretario", "presidente"]
  )
})

void test("the default place is clear space at the bottom right of the last page, beside a box already there", () => {
  const anchors = [
    ...paragraph(120, 30),
    ...paragraph(80, 10, { page: 1 }),
    run("Milano, 21 ottobre 2026", 400, 780, { page: 1 }),
    run("Pagina 2 di 2", 480, 815, { page: 1, size: 9 }),
  ]
  const first = defaultPlace(anchors, [A4, A4], [])
  assert.equal(first.page, 1)
  assert.ok(points(first).bottom > 600, JSON.stringify(points(first)))
  const second = defaultPlace(anchors, [A4, A4], [first])
  assertClear([first, second], anchors)
})

const minutes = (...labels) => [...paragraph(120, 6), ...labels]
const mario = { sub: "mario", name: "Mario Rossi" }
const anna = { sub: "anna", name: "Anna Bianchi" }

void test("a first document's spots become empty rows in reading order", () => {
  const anchors = minutes(run("Il Segretario", 100, 300), run("Il Presidente", 390, 300))
  const rows = placeRows([], findSpots(anchors, [A4]), anchors, [A4])
  assert.deepEqual(
    rows.map((r) => [r.role, r.person]),
    [
      ["Segretario", null],
      ["Presidente", null],
    ]
  )
})

void test("on another document people keep the spots it names; the others get a box and the old spots go", () => {
  const before = minutes(run("Il Segretario", 100, 300), run("Il Presidente", 390, 300))
  const [segretario, presidente] = placeRows([], findSpots(before, [A4]), before, [A4])
  const rows = [
    { ...presidente, person: mario },
    { ...segretario, person: anna },
  ]
  // The new document names the Presidente and the Tesoriere, not the Segretario.
  const after = minutes(run("Il Tesoriere", 100, 500), run("Il Presidente", 390, 500))
  const next = placeRows(rows, findSpots(after, [A4]), after, [A4])
  assert.deepEqual(
    next.map((r) => [r.role, r.person?.sub ?? null, r.spot?.key ?? null]),
    [
      ["Presidente", "mario", "presidente"],
      ["Segretario", "anna", null],
      ["Tesoriere", null, "tesoriere"],
    ]
  )
  assert.ok(points(next[0].places[0]).top > 500, "Mario's box is under the new label")
  assertClear(
    next.flatMap((r) => r.places),
    after
  )
})

void test("the same document read again keeps a free signer's places, unless their role names a label", () => {
  const anchors = minutes(run("Il Presidente", 380, 420))
  const old = { kind: "signature", page: 0, x: 0.1, y: 0.85, width: 0.3, height: 0.07 }
  const mark = { kind: "mark", page: 1, x: 0.6, y: 0.85, width: 0.3, height: 0.07 }
  const rows = [
    { id: "person:anna", spot: null, person: anna, role: "Fornitore", places: [old, mark] },
    { id: "person:mario", spot: null, person: mario, role: "Presidente", places: [old] },
  ]
  const kept = placeRows(rows, findSpots(anchors, [A4, A4]), anchors, [A4, A4], { keepPlaces: true })
  assert.deepEqual(kept[0].places, [old, mark], "Anna keeps both places")
  assert.equal(kept[1].spot?.key, "presidente", "Mario fills the Presidente spot")

  // A page the document no longer has, or another document: the places are laid out anew.
  const shorter = placeRows(rows.slice(0, 1), [], anchors, [A4], { keepPlaces: true })
  assert.notDeepEqual(shorter[0].places, [old, mark])
  const changed = placeRows(rows.slice(0, 1), [], anchors, [A4, A4])
  assert.notDeepEqual(changed[0].places, [old, mark])
})

void test("a free signer whose typed role names a spot takes it, and Presidente never takes Vicepresidente", () => {
  const anchors = minutes(run("Il Vicepresidente", 72, 420), run("Il Presidente", 380, 420))
  const free = { id: "person:mario", spot: null, person: mario, role: "Presidente", places: [] }
  const next = placeRows([free], findSpots(anchors, [A4]), anchors, [A4])
  assert.deepEqual(
    next.map((r) => [r.spot?.key, r.person?.sub ?? null]),
    [
      ["presidente", "mario"],
      ["vicepresidente", null],
    ]
  )
})
