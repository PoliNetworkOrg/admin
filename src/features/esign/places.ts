import type { PageSize } from "./pdf-viewer"
import type { BoxPlacement } from "./signature-box"

/** One of a signer's boxes: a full signature of its own, or a mark repeating their first signature. */
export type Place = BoxPlacement & { kind: "signature" | "mark" }

export function pagesLabel(places: Pick<Place, "page">[]) {
  const pages = [...new Set(places.map((p) => p.page + 1))].sort((a, b) => a - b)
  if (pages.length === 1) return `page ${pages[0]}`
  return `pages ${pages.slice(0, -1).join(", ")} and ${pages.at(-1)}`
}

/** "2 signatures and 1 mark", or "1 signature". */
export function kindsLabel(places: Pick<Place, "kind">[]) {
  const signatures = places.filter((p) => p.kind === "signature").length
  const marks = places.length - signatures
  const parts = [`${signatures} ${signatures === 1 ? "signature" : "signatures"}`]
  if (marks > 0) parts.push(`${marks} ${marks === 1 ? "mark" : "marks"}`)
  return parts.join(" and ")
}

/** Keeps at least one full signature: when none is left, the first place becomes one. */
export function withSignature<T extends Place>(places: T[]): T[] {
  if (places.length === 0 || places.some((p) => p.kind === "signature")) return places
  return places.map((p, i) => (i === 0 ? { ...p, kind: "signature" } : p))
}

/**
 * The places still to sign: full signatures after the first `signaturesDone`, and the marks, which the first
 * signature draws, while it isn't done.
 */
export function placesLeft<T extends Pick<Place, "kind">>(places: T[], signaturesDone: number): T[] {
  let signature = 0
  return places.filter((p) => (p.kind === "mark" ? signaturesDone === 0 : signature++ >= signaturesDone))
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * The place moved to a click on `page` (fractions of that page): centred on the click, inside the page, and the same
 * size in points, so it doesn't grow or shrink on a page of another size.
 */
export function placeAt(place: Place, pages: PageSize[], page: number, x: number, y: number): Place {
  const width = clamp((place.width * pages[place.page].width) / pages[page].width, 0.04, 1)
  const height = clamp((place.height * pages[place.page].height) / pages[page].height, 0.04, 1)
  return {
    kind: place.kind,
    page,
    width,
    height,
    x: clamp(x - width / 2, 0, 1 - width),
    y: clamp(y - height / 2, 0, 1 - height),
  }
}

/** A run of text on a page, in fractions of the displayed page (origin top-left). */
export type TextAnchor = { page: number; text: string; x: number; y: number; width: number; height: number }

/** A signature spot: a label found in the PDF ("Il Presidente") with a box under it on every page that repeats it. */
export type Spot = { id: string; key: string; role: string; places: Place[] }

/** A signature box of 190 × 62 pt, the size of a typical handwritten-signature space. */
export const BOX_PT = { width: 190, height: 62 }

/** The roles a signature label can name, as the role field suggests them. Labels may also use the feminine form. */
export const SIGN_ROLES = [
  "Presidente",
  "Vicepresidente",
  "Segretario",
  "Tesoriere",
  "Consigliere",
  "Socio",
  "Revisore",
  "Direttore",
  "Coordinatore",
  "Legale rappresentante",
]

/** Feminine forms, keyed as the masculine one: "La Segretaria" is the same spot as "Il Segretario". */
const FEMININE = new Map([
  ["segretaria", "segretario"],
  ["tesoriera", "tesoriere"],
  ["consigliera", "consigliere"],
  ["socia", "socio"],
  ["revisora", "revisore"],
  ["direttrice", "direttore"],
  ["coordinatrice", "coordinatore"],
])
const QUALIFIERS = ["vice", "co", "sotto", "ex", "pro"]
/** Words that may follow a role in a label without changing whose signature it is. */
const TAILS = [
  "verbalizzante",
  "della seduta",
  "dell'assemblea",
  "del consiglio direttivo",
  "dell'associazione",
  "pro tempore",
]
const APOSTROPHES = /[’‘`´]/g
/** "F.to", "Firma del", and the article. */
const PREFIX = String.raw`(?:f\.?\s?to\s+)?(?:firma\s+(?:del|della|dello|dell'|dei)\s*)?(?:(?:il\/la|il|la|lo)\s+|l'\s*)?`
const ROLE_WORDS = [...SIGN_ROLES.map((role) => role.toLowerCase()), ...FEMININE.keys()]
const LABEL = new RegExp(
  `^(?<prefix>${PREFIX})(?:(?<qualifier>${QUALIFIERS.join("|")})[\\s-]?)?(?<role>${ROLE_WORDS.join("|")})(?:\\/a)?(?:\\s+(?:${TAILS.join("|")}))?$`
)
const ORIGINAL_PREFIX = new RegExp(`^${PREFIX.replaceAll("'", "['’‘`´]")}`, "i")
/** A signature line: underscores, dots or ellipses. */
const UNDERLINE = /^(?:_{3,}|\.{3,}|…{2,}|(?:\. ){3,}\.?)$/
/** Where one text run holds several pieces: wide spaces between labels, and signature lines. */
const BREAKS = /\s{3,}|_{3,}|\.{3,}|…{2,}|(?:\. ){3,}\.?/g

/** Lowercase, no accents, one kind of apostrophe and single spaces. */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(APOSTROPHES, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** A text without what may trail a label: "Il Presidente: ____" reads "Il Presidente". */
const trimTrail = (text: string) => text.replace(/[\s:._…]+$/, "")

function matchLabel(text: string) {
  const match = LABEL.exec(trimTrail(fold(text)))
  if (!match?.groups) return null
  const { prefix, qualifier = "", role } = match.groups
  return {
    key: qualifier + (FEMININE.get(role) ?? role),
    // As the PDF writes it, without "Firma del" and the article.
    role: trimTrail(text.replace(/\s+/g, " ").trim()).replace(ORIGINAL_PREFIX, ""),
    /** Neither article, "Firma del" nor a colon: as likely a word in a table as a label. */
    bare: prefix === "" && !/:\s*[_.…]*\s*$/.test(text),
  }
}

/**
 * The spot a label or a typed role names: "Il Vice Presidente" → `vicepresidente`, role "Vice Presidente". Null when
 * the text is more than a label ("Il Presidente apre la seduta") or names no known role.
 */
export function roleKey(text: string): { key: string; role: string } | null {
  const match = matchLabel(text)
  return match && { key: match.key, role: match.role }
}

/** Points from the page's top-left corner. */
type Rect = { x: number; y: number; width: number; height: number }
/**
 * A run of text between wide gaps on one line. Its column runs halfway to its neighbours: `left`/`right` stop at the
 * page's text block, `edgeLeft`/`edgeRight` at the page margins.
 */
type Segment = Rect & { text: string; line: number; left: number; right: number; edgeLeft: number; edgeRight: number }
type PageText = { size: PageSize; obstacles: Rect[]; underlines: Rect[]; segments: Segment[] }

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width
const middle = (r: Rect) => r.y + r.height / 2
function overlap(a: Rect, b: Rect) {
  const w = Math.min(right(a), right(b)) - Math.max(a.x, b.x)
  const h = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}
/** pdf.js measures text from the baseline up: below it go the descenders, about a fifth of the height. */
const textBottom = (r: Rect) => r.y + r.height * 1.2
/** Room kept around text a box must not cover. */
const PAD = 2

/** The page's text as lines of segments, the text a box must not cover, and the signature lines it may sit on. */
function readPage(anchors: TextAnchor[], size: PageSize): PageText {
  const pieces: (Rect & { text: string })[] = []
  const underlines: Rect[] = []
  for (const anchor of anchors) {
    const run: Rect = {
      x: anchor.x * size.width,
      y: anchor.y * size.height,
      width: anchor.width * size.width,
      height: Math.max(anchor.height * size.height, 1),
    }
    // Pieces of one run are placed in proportion to their characters.
    const perChar = run.width / Math.max(anchor.text.length, 1)
    const piece = (from: number, to: number) => ({ ...run, x: run.x + from * perChar, width: (to - from) * perChar })
    let from = 0
    const take = (to: number) => {
      const text = anchor.text.slice(from, to)
      const start = from + (text.length - text.trimStart().length)
      const end = to - (text.length - text.trimEnd().length)
      if (end > start) pieces.push({ ...piece(start, end), text: anchor.text.slice(start, end) })
    }
    for (const found of anchor.text.matchAll(BREAKS)) {
      take(found.index)
      if (UNDERLINE.test(found[0].trim())) underlines.push(piece(found.index, found.index + found[0].length))
      from = found.index + found[0].length
    }
    take(anchor.text.length)
  }

  // Lines: runs whose vertical middles are close, left to right.
  const lines: (typeof pieces)[] = []
  for (const piece of [...pieces].sort((a, b) => middle(a) - middle(b))) {
    const line = lines.at(-1)
    const first = line?.[0]
    if (line && first && Math.abs(middle(piece) - middle(first)) < 0.4 * Math.max(piece.height, first.height))
      line.push(piece)
    else lines.push([piece])
  }

  const textLeft = Math.min(...pieces.map((p) => p.x), ...underlines.map((u) => u.x))
  const textRight = Math.max(...pieces.map(right), ...underlines.map(right))
  const margin = size.width * 0.02
  const segments: Segment[] = []
  lines.forEach((line, index) => {
    line.sort((a, b) => a.x - b.x)
    const height = Math.max(...line.map((p) => p.height))
    const runs: (Rect & { text: string })[] = []
    for (const piece of line) {
      const last = runs.at(-1)
      const gap = last ? piece.x - right(last) : Number.POSITIVE_INFINITY
      if (last && gap <= 1.5 * height) {
        const top = Math.min(last.y, piece.y)
        last.text += (gap > 0.1 * height ? " " : "") + piece.text
        last.height = Math.max(bottom(last), bottom(piece)) - top
        last.y = top
        last.width = right(piece) - last.x
      } else runs.push({ ...piece })
    }
    runs.forEach((run, i) => {
      const before = runs[i - 1]
      const after = runs[i + 1]
      const edgeLeft = before ? (right(before) + run.x) / 2 : margin
      const edgeRight = after ? (right(run) + after.x) / 2 : size.width - margin
      // Within the page's text block too, unless the run itself sticks out of it.
      const left = Math.min(Math.max(edgeLeft, textLeft), run.x)
      const end = Math.max(Math.min(edgeRight, textRight), right(run))
      segments.push({ ...run, line: index, left, right: end, edgeLeft, edgeRight })
    })
  })

  const obstacles = pieces.map((p) => ({
    x: p.x - PAD,
    y: p.y - PAD,
    width: p.width + 2 * PAD,
    height: textBottom(p) - p.y + 2 * PAD,
  }))
  return { size, obstacles, underlines, segments }
}

/**
 * A box for a label: on the signature line under it or beside it, else in the clear space below it (past a name line
 * printed under the label), else above it. It stays in the label's column and inside the page, and covers no text and
 * no box in `taken`; when nothing is clear, the place covering the least.
 */
function clearPlacement(label: Segment, page: PageText, taken: Rect[]) {
  const { width: pageWidth, height: pageHeight } = page.size
  const obstacles = [...page.obstacles, ...taken]
  const width = Math.max(120, Math.min(BOX_PT.width, label.right - label.left - 8))
  /** Centred on `center`, inside the column when it fits. */
  const columnX = (center: number, boxWidth = width) =>
    label.right - boxWidth < label.left
      ? center - boxWidth / 2
      : clamp(center - boxWidth / 2, label.left, label.right - boxWidth)
  /** Inside the page, with a 2% margin. */
  const fit = (x: number, y: number, height: number, boxWidth = width): Rect => ({
    x: clamp(x, pageWidth * 0.02, pageWidth * 0.98 - boxWidth),
    y: clamp(y, pageHeight * 0.02, pageHeight * 0.98 - height),
    width: boxWidth,
    height,
  })
  const labelBottom = textBottom(label) + PAD
  const candidates: Rect[] = []

  // A signature line under the label, or after it on its line: the box stands on it, below whatever is above it.
  for (const line of page.underlines) {
    const under =
      line.y >= middle(label) && line.y <= labelBottom + 60 && line.x < label.right && right(line) > label.left
    const beside =
      Math.abs(middle(line) - middle(label)) < 0.4 * Math.max(line.height, label.height) &&
      line.x >= right(label) - 1 &&
      line.x < label.edgeRight
    if (!under && !beside) continue
    const base = line.y + line.height * 1.1
    // As wide as the line, within the column.
    const start = under ? line.x : Math.max(line.x, right(label) + PAD + 1)
    const room = under ? width : Math.min(BOX_PT.width, label.edgeRight - start)
    const boxWidth = Math.min(Math.max(right(line) - start, 120), room)
    const x = under ? columnX(line.x + line.width / 2, boxWidth) : start
    const above = obstacles.filter((o) => o.x < x + boxWidth && right(o) > x && bottom(o) <= base + 1)
    const top = Math.max(base - BOX_PT.height, ...above.map((o) => bottom(o) + 1))
    if (base - top >= 30 && boxWidth >= 120) candidates.push(fit(x, top, base - top, boxWidth))
  }
  const x = columnX(label.x + label.width / 2)
  for (const height of [BOX_PT.height, 44])
    for (let gap = 4; gap <= 80; gap += 2) candidates.push(fit(x, textBottom(label) + gap, height))
  for (const height of [BOX_PT.height, 44])
    for (let gap = 4; gap <= 80; gap += 2) candidates.push(fit(x, label.y - gap - height, height))

  let best = { rect: candidates[0], covered: Number.POSITIVE_INFINITY }
  for (const rect of candidates) {
    const covered = obstacles.reduce((sum, o) => sum + overlap(rect, o), 0)
    if (covered === 0) return { rect, covered }
    if (covered < best.covered) best = { rect, covered }
  }
  return best
}

const toPlacement = (rect: Rect, page: number, size: PageSize): BoxPlacement => ({
  page,
  x: rect.x / size.width,
  y: rect.y / size.height,
  width: rect.width / size.width,
  height: rect.height / size.height,
})
const toRect = (p: BoxPlacement, size: PageSize): Rect => ({
  x: p.x * size.width,
  y: p.y * size.height,
  width: p.width * size.width,
  height: p.height * size.height,
})

function readPages(anchors: TextAnchor[], pages: PageSize[]) {
  return pages.map((size, page) =>
    readPage(
      anchors.filter((a) => a.page === page),
      size
    )
  )
}

/** The segments of a page that are labels; a bare role only on a line of labels, with room to sign. */
function labelsOf(page: PageText) {
  const matches = page.segments.map((segment) => ({ segment, match: matchLabel(segment.text) }))
  return matches.flatMap(({ segment, match }) => {
    if (!match) return []
    if (match.bare) {
      const lineOfLabels = matches.every((m) => m.segment.line !== segment.line || m.match)
      if (!lineOfLabels || clearPlacement(segment, page, []).covered > 0) return []
    }
    return [{ segment, ...match }]
  })
}

/**
 * The signature spots of a document, in reading order. A label repeated on several pages is one spot with a box on
 * each; repeated on one page, it is a spot per occurrence. Each box goes in clear space under its label, and the
 * boxes already placed count as text for the next.
 */
export function findSpots(anchors: TextAnchor[], pages: PageSize[]): Spot[] {
  const spots = new Map<string, Spot>()
  readPages(anchors, pages).forEach((page, index) => {
    const taken: Rect[] = []
    const seen = new Map<string, number>()
    for (const label of labelsOf(page)) {
      const occurrence = seen.get(label.key) ?? 0
      seen.set(label.key, occurrence + 1)
      const { rect } = clearPlacement(label.segment, page, taken)
      taken.push(rect)
      const id = `${label.key}-${occurrence}`
      const spot = spots.get(id) ?? { id, key: label.key, role: label.role, places: [] }
      spot.places.push({ kind: "signature", ...toPlacement(rect, index, page.size) })
      spots.set(id, spot)
    }
  })
  return [...spots.values()]
}

/** Whether `text` holds the words of `role` as whole words, not after a qualifier ("Vice Presidente" isn't "Presidente"). */
function namesRole(text: string, role: string[]) {
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.length > 6) return false
  return words.some(
    (_, i) => role.every((word, j) => words[i + j] === word) && (i === 0 || !QUALIFIERS.includes(words[i - 1]))
  )
}

/**
 * Where a signer with a typed role signs: under the label naming the role (the last one, as signatures come at the
 * end), in clear space that avoids text and the boxes in `taken`. Null when the document doesn't name the role.
 */
export function placeUnderRole(
  role: string,
  anchors: TextAnchor[],
  pages: PageSize[],
  taken: BoxPlacement[]
): BoxPlacement | null {
  const folded = fold(role)
  if (folded.length < 3) return null
  const key = roleKey(role)?.key
  const words = folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const read = readPages(anchors, pages)
  const labels = read.flatMap((page, index) =>
    page.segments.map((segment) => ({ page, index, segment, match: matchLabel(segment.text) }))
  )
  const found =
    (key !== undefined &&
      (labels.findLast((l) => l.match?.key === key && !l.match.bare) ??
        labels.findLast((l) => l.match?.key === key))) ||
    labels.findLast((l) => namesRole(fold(l.segment.text), words))
  if (!found) return null
  const boxes = taken.filter((p) => p.page === found.index).map((p) => toRect(p, found.page.size))
  return toPlacement(clearPlacement(found.segment, found.page, boxes).rect, found.index, found.page.size)
}

/**
 * Where a signer without a label signs: the first clear space on the last page, scanning from its bottom-right
 * corner leftwards, then upwards, so a second signer lands beside the first. Corner slots when the page is full.
 */
export function defaultPlace(anchors: TextAnchor[], pages: PageSize[], taken: BoxPlacement[]): BoxPlacement {
  const index = Math.max(pages.length - 1, 0)
  const size = pages[index] ?? { width: 595, height: 842 }
  const page = readPage(
    anchors.filter((a) => a.page === index),
    size
  )
  const boxes = taken.filter((p) => p.page === index).map((p) => toRect(p, size))
  // Away from labels it needn't sit close to the text: a little more room reads calmer.
  const room = 4
  const obstacles = [...page.obstacles, ...boxes].map((o) => ({
    x: o.x - room,
    y: o.y - room,
    width: o.width + 2 * room,
    height: o.height + 2 * room,
  }))
  const { width, height } = BOX_PT
  const marginX = size.width * 0.07
  const marginY = size.height * 0.07
  for (let y = size.height - marginY - height; y >= marginY; y -= 4)
    for (let x = size.width - marginX - width; x >= marginX; x -= 10) {
      const rect = { x, y, width, height }
      if (obstacles.every((o) => overlap(rect, o) === 0)) return toPlacement(rect, index, size)
    }
  const slot = boxes.length
  const column = slot % 2
  const row = Math.floor(slot / 2)
  const x = column === 0 ? size.width - marginX - width : marginX
  const y = Math.max(marginY, size.height - marginY - height - row * (height + 0.03 * size.height))
  return toPlacement({ x, y, width, height }, index, size)
}

/** `byRole`: the box a signer's typed role places under its label, until the user moves it. */
export type DraftPlace = Place & { byRole?: true }

/**
 * A row of the composer's signers, in signing order: a person, a spot found in the PDF waiting for one, or a person in
 * a spot. A spot row's role and boxes come from its label.
 */
export type SignerDraft = {
  /** Stays while the row lives: the spot's for a spot row, the person's for a free row. */
  id: string
  spot: Spot | null
  person: { sub: string; name: string } | null
  role: string
  places: DraftPlace[]
}

export function spotRow(spot: Spot, person: SignerDraft["person"]): SignerDraft {
  return { id: `spot:${spot.id}`, spot, person, role: spot.role, places: spot.places }
}

export function freeRow(person: NonNullable<SignerDraft["person"]>, role: string, box: BoxPlacement): SignerDraft {
  return { id: `person:${person.sub}`, spot: null, person, role, places: [{ ...box, kind: "signature", byRole: true }] }
}

/**
 * The signers on a document just read. A person keeps a spot of their role when the document has one (the spot they
 * had, or the label their typed role names); the others get a box under their role's label, or in clear space. They
 * keep their order, and the spots nobody fills follow as empty rows.
 *
 * `keepPlaces` is for the same document read again, such as a request sent again: a person whose role names no label
 * keeps their places while the document still has those pages.
 */
export function placeRows(
  rows: SignerDraft[],
  spots: Spot[],
  anchors: TextAnchor[],
  pages: PageSize[],
  { keepPlaces = false } = {}
) {
  const open = [...spots]
  const taken: BoxPlacement[] = spots.flatMap((s) => s.places)
  const placed: SignerDraft[] = []
  for (const { person, spot, role, places } of rows) {
    if (!person) continue
    const key = spot?.key ?? roleKey(role)?.key
    const at = open.findIndex((s) => s.key === key)
    if (at >= 0) {
      placed.push(spotRow(open.splice(at, 1)[0], person))
      continue
    }
    const underRole = placeUnderRole(role, anchors, pages, taken)
    if (!underRole && keepPlaces && places.length > 0 && places.every((p) => p.page < pages.length)) {
      taken.push(...places)
      placed.push({ id: `person:${person.sub}`, spot: null, person, role, places })
      continue
    }
    const box = underRole ?? defaultPlace(anchors, pages, taken)
    taken.push(box)
    placed.push(freeRow(person, role, box))
  }
  return [...placed, ...open.map((spot) => spotRow(spot, null))]
}
