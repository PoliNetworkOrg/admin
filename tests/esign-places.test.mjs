import assert from "node:assert/strict"
import test from "node:test"

import { defaultPlaces, findSpots, placeAt, placeRows, placeUnderRole, roleKey } from "../src/features/esign/places.ts"

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
  for (const label of ["Il Vicepresidente", "Il Vice Presidente", "Il Vice-Presidente", "Il Vice – Presidente"])
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

void test("labels stacked tightly in one column get their boxes beside them, never between two labels", () => {
  for (const gap of [40, 55]) {
    const labels = [
      run("Il Presidente", 380, 572),
      run("Il Vicepresidente", 380, 572 + gap),
      run("Il Tesoriere", 380, 572 + 2 * gap),
    ]
    const anchors = [...paragraph(120, 4), ...labels]
    const spots = findSpots(anchors, [A4])
    assert.deepEqual(
      spots.map((s) => s.key),
      ["presidente", "vicepresidente", "tesoriere"],
      `${gap} pt`
    )
    assertClear(
      spots.flatMap((s) => s.places),
      anchors
    )
    const boxes = spots.map((s) => points(s.places[0]))
    for (const [i, box] of boxes.entries()) {
      // A reader pairs a box with the nearest label: its own.
      const centre = (box.top + box.bottom) / 2
      const distances = labels.map((l) => Math.abs((l.y + l.height / 2) * A4.height - centre))
      assert.equal(distances.indexOf(Math.min(...distances)), i, `${gap} pt: ${JSON.stringify(boxes)}`)
    }
    // One side for the whole stack, lined up.
    assert.equal(new Set(boxes.map((b) => Math.round(b.left))).size, 1, JSON.stringify(boxes))
  }
})

void test("a stack of labels with names under them gets its boxes past the names, beside each label", () => {
  const labels = [run("Il Presidente", 72, 480), run("Il Segretario", 72, 535)]
  const anchors = [
    ...paragraph(120, 4),
    ...labels,
    run("(Mario Rossi)", 72, 494, { width: 66 }),
    run("(Anna Bianchi)", 72, 549, { width: 72 }),
  ]
  const spots = findSpots(anchors, [A4])
  assert.deepEqual(
    spots.map((s) => s.key),
    ["presidente", "segretario"]
  )
  assertClear(
    spots.flatMap((s) => s.places),
    anchors
  )
  const boxes = spots.map((s) => points(s.places[0]))
  for (const [i, box] of boxes.entries()) {
    const centre = (box.top + box.bottom) / 2
    const distances = labels.map((l) => Math.abs((l.y + l.height / 2) * A4.height - centre))
    assert.equal(distances.indexOf(Math.min(...distances)), i, JSON.stringify(boxes))
    assert.ok(box.left >= 72 + 72, "past the longest name")
  }
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

void test("the default places fill the foot of the last page in signing order, keeping off text and boxes", () => {
  const anchors = [
    ...paragraph(120, 30),
    ...paragraph(80, 10, { page: 1 }),
    run("Milano, 21 ottobre 2026", 72, 700, { page: 1 }),
    run("Pagina 2 di 2", 480, 815, { page: 1, size: 9 }),
  ]
  const [alone] = defaultPlaces(anchors, [A4, A4], [], 1)
  assert.equal(alone.page, 1)
  assert.ok(points(alone).left > 300 && points(alone).top > 600, JSON.stringify(points(alone)))

  // Two share the bottom row, the first on the left; a third goes on the row above, first of all.
  const [first, second] = defaultPlaces(anchors, [A4, A4], [], 2)
  assert.ok(points(first).right < points(second).left && first.y === second.y, "side by side, in order")
  const three = defaultPlaces(anchors, [A4, A4], [], 3)
  assert.ok(points(three[0]).bottom <= points(three[1]).top, "the row above comes first")
  assert.ok(points(three[1]).right < points(three[2]).left, "then the bottom row, left to right")
  assertClear(three, anchors)

  // A box already on the page is kept off.
  const taken = { page: 1, x: 0.55, y: 0.78, width: 0.35, height: 0.08 }
  const [beside] = defaultPlaces(anchors, [A4, A4], [taken], 1)
  assertClear([taken, beside], anchors)
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

void test("a field filled in on its line is no label, on its page or merged with a later one", () => {
  const anchors = [
    run("Presidente:", 72, 110),
    run("Mario Rossi", 180, 110),
    run("Segretario:", 72, 125),
    run("Anna Bianchi", 180, 125),
    ...paragraph(150, 30),
    ...paragraph(80, 5, { page: 1 }),
    run("Il Segretario", 100, 300, { page: 1 }),
    run("Il Presidente", 390, 300, { page: 1 }),
  ]
  const spots = findSpots(anchors, [A4, A4])
  assert.deepEqual(
    spots.map((s) => [s.id, s.places.map((p) => p.page)]),
    [
      ["segretario-0", [1]],
      ["presidente-0", [1]],
    ]
  )
  // A signature line after the caption makes it one again.
  const toSign = [
    ...paragraph(120, 6),
    run("Il Presidente:", 72, 300),
    run("Mario Rossi", 200, 300),
    run("_".repeat(20), 290, 300),
  ]
  assert.deepEqual(
    findSpots(toSign, [A4]).map((s) => s.key),
    ["presidente"]
  )
})

void test("a sentence that ends on a line of its own is no label", () => {
  const wrapped = [...paragraph(120, 6), run("il Presidente.", 72, 210), ...paragraph(240, 6)]
  assert.deepEqual(findSpots(wrapped, [A4]), [])
  // At the end of the text, with room under it, it is still the end of a sentence.
  const last = [...paragraph(120, 6), run("Presidente.", 72, 210)]
  assert.deepEqual(findSpots(last, [A4]), [])
  // A label right under a closing line is still a label.
  const closing = [
    ...paragraph(120, 6),
    run("Letto, approvato e sottoscritto.", 72, 300),
    run("Il Presidente", 380, 314),
  ]
  assert.deepEqual(
    findSpots(closing, [A4]).map((s) => s.key),
    ["presidente"]
  )
})

void test("a label wrapped in a narrow cell keeps its qualifier: Vice over Presidente is never the Presidente", () => {
  const table = [
    ...paragraph(120, 10),
    run("Il Segretario", 60, 600),
    run("Il Vice", 170, 600),
    run("Il Presidente", 280, 600),
    run("Il Tesoriere", 390, 600),
    run("Il Consigliere", 490, 600, { width: 80 }),
    run("Presidente", 170, 614),
  ]
  const spots = findSpots(table, [A4])
  assert.deepEqual(
    spots.map((s) => [s.key, s.role]),
    [
      ["segretario", "Segretario"],
      ["vicepresidente", "Vice Presidente"],
      ["presidente", "Presidente"],
      ["tesoriere", "Tesoriere"],
      ["consigliere", "Consigliere"],
    ]
  )
  assertClear(
    spots.flatMap((s) => s.places),
    table
  )
  const hyphen = [...paragraph(120, 6), run("Il Vice-", 100, 300), run("Presidente", 100, 314)]
  assert.deepEqual(
    findSpots(hyphen, [A4]).map((s) => [s.key, s.role]),
    [["vicepresidente", "Vice-Presidente"]]
  )
})

void test("near the page bottom a box covers neither its label nor the footer", () => {
  const anchors = [
    ...Array.from({ length: 38 }, (_, i) =>
      run(`Riga ${i + 1} del testo che arriva fino a fondo pagina.`, 72, 200 + i * 15)
    ),
    run("Il Segretario", 72, 790),
    run("Il Presidente", 420, 790),
    run("Pagina 1 di 1 - PoliNetwork APS - Verbale del Consiglio Direttivo", 150, 820, { size: 8 }),
  ]
  const spots = findSpots(anchors, [A4])
  assert.deepEqual(
    spots.map((s) => s.key),
    ["segretario", "presidente"]
  )
  assertClear(
    spots.flatMap((s) => s.places),
    anchors
  )
  // Under or beside a label with a footer under it, a shorter box or one moved aside fits.
  const footer = [
    ...paragraph(120, 40),
    run("Il Segretario", 100, 760),
    run("Il Presidente", 390, 760),
    run("Pagina 2 di 2", 270, 815, { size: 9 }),
  ]
  assertClear(
    findSpots(footer, [A4]).flatMap((s) => s.places),
    footer
  )
})

void test("a label with text right under it gets its box above, never past the text", () => {
  const anchors = [
    ...paragraph(120, 3),
    run("Firma del Presidente", 72, 260),
    run("Testo che segue la firma del presidente, a trenta punti sotto.", 72, 290),
    run("LA SEGRETARIA", 72, 380),
    run("Testo che segue la firma della segretaria, a trenta punti sotto.", 72, 410),
  ]
  const spots = findSpots(anchors, [A4])
  assert.deepEqual(
    spots.map((s) => [s.key, points(s.places[0]).bottom <= (s.key === "presidente" ? 249 : 369)]),
    [
      ["presidente", true],
      ["segretario", true],
    ]
  )
  assertClear(
    spots.flatMap((s) => s.places),
    anchors
  )
})

void test("a label in the middle of dense text has no room to sign and is no spot", () => {
  const anchors = [...paragraph(250, 10), run("Il Presidente", 72, 400), ...paragraph(415, 24)]
  assert.deepEqual(findSpots(anchors, [A4]), [])
})

void test("a typed role goes only where a box covers nothing: a sentence naming it gets none", () => {
  const contract = [...paragraph(100, 20), run("Il Presidente ha aperto la seduta.", 72, 400), ...paragraph(415, 15)]
  assert.equal(placeUnderRole("Presidente", contract, [A4], []), null)
  // A short caption naming the role, with room under it, does.
  const caption = [...paragraph(100, 6), run("Per l'Associazione, il Presidente", 300, 400)]
  const box = placeUnderRole("Presidente", caption, [A4], [])
  assert.ok(box && points(box).top >= 400, JSON.stringify(box && points(box)))
  assertClear([box], caption)
})

void test("a signature already on the page signs its label, and boxes keep off it", () => {
  const anchors = [
    ...paragraph(120, 6),
    run("Il Segretario", 70, 660),
    run("Il Presidente", 380, 660),
    { page: 0, text: "", kind: "signature", x: 60 / 595, y: 631 / 842, width: 179 / 595, height: 67 / 842 },
  ]
  const spots = findSpots(anchors, [A4])
  assert.deepEqual(
    spots.map((s) => s.key),
    ["presidente"]
  )
  const box = points(spots[0].places[0])
  assert.ok(box.left >= 241 || box.top >= 700, JSON.stringify(box))
})

void test("sideways text is kept off but never read as a label", () => {
  const anchors = [
    ...paragraph(120, 6),
    run("Il Presidente", 380, 400),
    { page: 0, text: "", kind: "sideways", x: 380 / 595, y: 410 / 842, width: 12 / 595, height: 200 / 842 },
  ]
  const [spot] = findSpots(anchors, [A4])
  const box = points(spot.places[0])
  assert.ok(box.right <= 378 || box.left >= 394 || box.bottom <= 408, JSON.stringify(box))
})

void test("the same document sent again keeps the marks of a person in a spot", () => {
  const anchors = [
    run("Riga del verbale.", 72, 120),
    run("Riga del verbale.", 72, 120, { page: 1 }),
    run("Il Segretario", 100, 400, { page: 1 }),
    run("Il Presidente", 390, 400, { page: 1 }),
  ]
  const mark = { kind: "mark", page: 0, x: 0.8, y: 0.9, width: 0.12, height: 0.05 }
  const old = { kind: "signature", page: 1, x: 0.12, y: 0.49, width: 0.32, height: 0.07 }
  const rows = [{ id: "person:anna", spot: null, person: anna, role: "Segretario", places: [mark, old] }]
  const spots = findSpots(anchors, [A4, A4])
  const [again] = placeRows(rows, spots, anchors, [A4, A4], { keepPlaces: true })
  assert.deepEqual(
    again.places.map((p) => [p.kind, p.page]),
    [
      ["signature", 1],
      ["mark", 0],
    ]
  )
  // Another document lays them out anew.
  const [other] = placeRows(rows, spots, anchors, [A4, A4])
  assert.deepEqual(
    other.places.map((p) => [p.kind, p.page]),
    [["signature", 1]]
  )
})
