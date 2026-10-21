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

/**
 * A run of text on a page, in fractions of the displayed page (origin top-left), reading left to right. Otherwise
 * `kind` says what else a box keeps off: a signature already on the page, the rectangle of its field ("signature"),
 * whose label is signed; or text that runs another way, such as a note up the margin ("sideways"), never a label.
 */
export type TextAnchor = {
  page: number
  text: string
  x: number
  y: number
  width: number
  height: number
  kind?: "signature" | "sideways"
}

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
const DASHES = /[‐‑‒–—]/g
/** "F.to", "Firma del", and the article. */
const PREFIX = String.raw`(?:f\.?\s?to\s+)?(?:firma\s+(?:del|della|dello|dell'|dei)\s*)?(?:(?:il\/la|il|la|lo)\s+|l'\s*)?`
const ROLE_WORDS = [...SIGN_ROLES.map((role) => role.toLowerCase()), ...FEMININE.keys()]
const LABEL = new RegExp(
  `^(?<prefix>${PREFIX})(?:(?<qualifier>${QUALIFIERS.join("|")})\\s*-?\\s*)?(?<role>${ROLE_WORDS.join("|")})(?:\\/a)?(?:\\s+(?:${TAILS.join("|")}))?$`
)
/**
 * The first line of a label wrapped in a narrow cell, tested with a space after it: "Il Vice" or "Il Vice-" over
 * "Presidente", "Firma del" over "Presidente".
 */
const LABEL_START = new RegExp(`^(?=\\S)${PREFIX}(?:(?:${QUALIFIERS.join("|")})\\s*-?)?\\s*$`)
const ORIGINAL_PREFIX = new RegExp(`^${PREFIX.replaceAll("'", "['’‘`´]")}`, "i")
/** A signature line: underscores, dots or ellipses. */
const UNDERLINE = /^(?:_{3,}|\.{3,}|…{2,}|(?:\. ){3,}\.?)$/
/** Where one text run holds several pieces: wide spaces between labels, and signature lines. */
const BREAKS = /\s{3,}|_{3,}|\.{3,}|…{2,}|(?:\. ){3,}\.?/g

/** Lowercase, no accents, one kind of apostrophe and of dash, and single spaces. */
function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(APOSTROPHES, "'")
    .replace(DASHES, "-")
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
type Label = NonNullable<ReturnType<typeof matchLabel>>

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
 * A run of text between wide gaps on one line, or a label wrapped over two lines. Its column runs halfway to its
 * neighbours: `left`/`right` stop at the page's text block, `edgeLeft`/`edgeRight` at the page margins.
 */
type Segment = Rect & {
  text: string
  /** The line it starts on; lines are numbered top to bottom. */
  line: number
  /** The bottom of its glyphs, descenders included. */
  foot: number
  /** About the font size: its tallest run's height. */
  size: number
  left: number
  right: number
  edgeLeft: number
  edgeRight: number
  label: Label | null
  /** The first line of a label wrapped onto the next one, whose segment holds the whole label. */
  part?: true
}
type PageText = { size: PageSize; segments: Segment[]; underlines: Rect[]; signatures: Rect[]; sideways: Rect[] }

const bottom = (r: Rect) => r.y + r.height
const right = (r: Rect) => r.x + r.width
const middle = (r: Rect) => r.y + r.height / 2
function overlap(a: Rect, b: Rect) {
  const w = Math.min(right(a), right(b)) - Math.max(a.x, b.x)
  const h = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}
/** Whether two rectangles share some width. */
const acrossFrom = (a: Rect, b: Rect) => a.x < right(b) && right(a) > b.x
/** pdf.js measures text from the baseline up: below it go the descenders, about a fifth of the height. */
const textBottom = (r: Rect) => r.y + r.height * 1.2
/** Room kept around text a box must not cover. */
const PAD = 2
const grow = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + 2 * by,
  height: r.height + 2 * by,
})
/** The room a segment's text takes, a little padded. */
const room = (s: Segment) => grow({ x: s.x, y: s.y, width: s.width, height: s.foot - s.y }, PAD)
/** Labels and the first lines of wrapped ones: text a box never covers, even when no place is clear. */
const isLabel = (s: Segment) => s.label !== null || s.part === true

/** The page's text as segments on lines, the signatures already on it, and the signature lines a box may sit on. */
function readPage(anchors: TextAnchor[], size: PageSize): PageText {
  const pieces: (Rect & { text: string })[] = []
  const underlines: Rect[] = []
  const signatures: Rect[] = []
  const sideways: Rect[] = []
  for (const anchor of anchors) {
    const run: Rect = {
      x: anchor.x * size.width,
      y: anchor.y * size.height,
      width: anchor.width * size.width,
      height: Math.max(anchor.height * size.height, 1),
    }
    if (anchor.kind) {
      const into = anchor.kind === "signature" ? signatures : sideways
      into.push(grow(run, PAD))
      continue
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
    const runs: (Rect & { text: string; foot: number; size: number })[] = []
    for (const piece of line) {
      const last = runs.at(-1)
      const gap = last ? piece.x - right(last) : Number.POSITIVE_INFINITY
      if (last && gap <= 1.5 * height) {
        const top = Math.min(last.y, piece.y)
        last.text += (gap > 0.1 * height ? " " : "") + piece.text
        last.height = Math.max(bottom(last), bottom(piece)) - top
        last.y = top
        last.width = right(piece) - last.x
        last.foot = Math.max(last.foot, textBottom(piece))
        last.size = Math.max(last.size, piece.height)
      } else runs.push({ ...piece, foot: textBottom(piece), size: piece.height })
    }
    runs.forEach((run, i) => {
      const before = runs[i - 1]
      const after = runs[i + 1]
      const edgeLeft = before ? (right(before) + run.x) / 2 : margin
      const edgeRight = after ? (right(run) + after.x) / 2 : size.width - margin
      // Within the page's text block too, unless the run itself sticks out of it.
      const left = Math.min(Math.max(edgeLeft, textLeft), run.x)
      const end = Math.max(Math.min(edgeRight, textRight), right(run))
      segments.push({ ...run, line: index, left, right: end, edgeLeft, edgeRight, label: null })
    })
  })
  joinWrappedLabels(segments)
  for (const segment of segments) if (!segment.part) segment.label = matchLabel(segment.text)
  return { size, segments, underlines, signatures, sideways }
}

/**
 * A label wrapped in a narrow cell reads as one: "Il Vice" over "Presidente" is the Vicepresidente, never a second
 * Presidente. The lower segment takes the whole label, the upper line's place in reading order and the column the two
 * share; the upper one becomes its `part`.
 */
function joinWrappedLabels(segments: Segment[]) {
  for (const lower of segments) {
    if (lower.part) continue
    const upper = segments
      .filter((s) => s.line < lower.line && !s.part && acrossFrom(s, lower) && lower.y - s.foot < 0.8 * lower.size)
      .sort((a, b) => b.foot - a.foot)[0]
    if (!upper || !LABEL_START.test(`${fold(upper.text)} `)) continue
    const text = `${upper.text.trimEnd()}${/[-‐‑‒–—'’]$/.test(upper.text.trimEnd()) ? "" : " "}${lower.text}`
    if (!matchLabel(text)) continue
    upper.part = true
    const x = Math.min(upper.x, lower.x)
    Object.assign(lower, {
      text,
      x,
      y: upper.y,
      width: Math.max(right(upper), right(lower)) - x,
      height: bottom(lower) - upper.y,
      line: upper.line,
      size: Math.max(upper.size, lower.size),
      left: Math.max(upper.left, lower.left),
      right: Math.min(upper.right, lower.right),
      edgeLeft: Math.max(upper.edgeLeft, lower.edgeLeft),
      edgeRight: Math.min(upper.edgeRight, lower.edgeRight),
    })
  }
}

/** A signature line on the same line as `segment`, starting after `x`. */
const lineAfter = (page: PageText, segment: Segment, x: number) =>
  page.underlines.some(
    (u) => u.x >= x - 1 && Math.abs(middle(u) - middle(segment)) < 0.4 * Math.max(u.height, segment.size)
  )

/**
 * Whether a label, or a short line naming a role, stands on its own to be signed under. Not when it captions a field
 * filled in on its line ("Presidente:   Mario Rossi") without a signature line, nor when it is the end of a sentence
 * wrapped onto a line of its own ("…approvato dal\nil Presidente.").
 */
function standsAlone(page: PageText, segment: Segment) {
  const next = page.segments
    .filter((s) => s !== segment && s.line === segment.line && s.x >= right(segment) - 1)
    .sort((a, b) => a.x - b.x)[0]
  if (next && !isLabel(next) && !lineAfter(page, segment, right(segment))) return false
  const above = page.segments
    .filter((s) => s.line < segment.line && acrossFrom(s, segment))
    .sort((a, b) => b.foot - a.foot)[0]
  const text = segment.text.trim()
  const sentence = /[^.]\.$/.test(text) || /^\p{Ll}/u.test(text)
  return !(sentence && above && !isLabel(above) && segment.y - above.foot < 0.8 * segment.size)
}

/** A bare role ("Presidente") is a label only on a line of labels, not as a word in a table. */
const amongLabels = (page: PageText, segment: Segment) =>
  page.segments.every((s) => s.line !== segment.line || isLabel(s))

/** A signature already on the page in the label's column, where its box would go: the label is signed. */
function signedUnder(page: PageText, label: Segment) {
  return page.signatures.some((signature) => {
    const shared = Math.min(right(signature), label.right) - Math.max(signature.x, label.left)
    return (
      shared >= Math.min(signature.width, label.right - label.left) / 2 &&
      signature.y < label.foot + 100 &&
      bottom(signature) > label.y - 100
    )
  })
}

/** Box heights: a full one, then shorter ones where the space is tight. */
const TALL = [BOX_PT.height, 44]
const SHORT = [36, 30]

/**
 * A box for a label, close to it and inside the page: on the signature line under or beside it; else in clear space
 * below it, past a short name line printed under the label but never past other text; else above it. It is tried in
 * the label's column first, then shifted towards the page margins, then shorter. `clear` is false when every such
 * place covers text: the place returned then covers the least, and never a label, a signature or a box in `taken`.
 */
function clearPlacement(label: Segment, page: PageText, taken: Rect[]) {
  const { width: pageWidth, height: pageHeight } = page.size
  const top = pageHeight * 0.02
  const floor = pageHeight * 0.98
  const near = (o: Rect) => bottom(o) > label.y - 180 && o.y < label.foot + 180
  const nameWidth = Math.max(label.width * 1.6, 170)
  /** Text a box may cover when nothing is clear; `name`: a short line, such as the name printed under a label. */
  const soft = page.segments
    .filter((s) => !isLabel(s) && near(s))
    .map((s) => ({ ...room(s), name: s.width <= nameWidth || /^\(.*\)$/.test(s.text.trim()) }))
    .concat(page.sideways.filter(near).map((r) => ({ ...r, name: false })))
  const labels = page.segments.filter(isLabel).map(room).filter(near)
  const hard = [...labels, ...page.signatures, ...taken].filter(near)
  /** What the box keeps to its own side of: the text around the label, not the other boxes. */
  const text = [...soft, ...labels]
  const obstacles = [...text, ...page.signatures, ...taken]
  const covered = (rect: Rect, of: Rect[]) => of.reduce((sum, o) => sum + overlap(rect, o), 0)

  const width = Math.max(120, Math.min(BOX_PT.width, label.right - label.left - 8))
  const centre = label.x + label.width / 2
  /** Centred on `center`, inside the column when it fits, and inside the page. */
  const columnX = (center: number, boxWidth: number) =>
    clamp(
      label.right - boxWidth < label.left
        ? center - boxWidth / 2
        : clamp(center - boxWidth / 2, label.left, label.right - boxWidth),
      pageWidth * 0.02,
      pageWidth * 0.98 - boxWidth
    )
  type Span = { x: number; width: number }
  const inColumn: Span[] = [{ x: columnX(centre, width), width }]
  // Out to the neighbouring columns or the page margins, still across from a good part of the label.
  const shifted: Span[] = []
  for (const boxWidth of new Set([Math.max(120, Math.min(BOX_PT.width, label.edgeRight - label.edgeLeft - 8)), 120]))
    for (let x = label.edgeLeft; x <= label.edgeRight - boxWidth; x += 6) {
      const shared = Math.min(x + boxWidth, right(label)) - Math.max(x, label.x)
      if (shared >= Math.min(label.width, boxWidth) / 2) shifted.push({ x, width: boxWidth })
    }
  shifted.sort((a, b) => Math.abs(a.x + a.width / 2 - centre) - Math.abs(b.x + b.width / 2 - centre))

  /** Under the label, from the nearest; unless `past`, it stops at the first line that isn't a short name line. */
  function below({ x, width: boxWidth }: Span, height: number, past = false) {
    const span = { x, y: 0, width: boxWidth, height: 0 }
    let limit = Number.POSITIVE_INFINITY
    if (!past) {
      const under = text.filter((o) => o.y >= label.foot - 1 && acrossFrom(o, span)).sort((a, b) => a.y - b.y)
      let names = 0
      let lastName = Number.NEGATIVE_INFINITY
      for (const o of under) {
        const name = "name" in o && o.name
        if (name && o.y > lastName + 4) {
          names++
          lastName = o.y
        }
        if (!name || names > 2) {
          limit = o.y
          break
        }
      }
    }
    const rects: Rect[] = []
    for (let gap = height < 40 ? 2 : 4; gap <= 80; gap += 2) {
      const y = label.foot + gap
      if (y + height > floor || y >= limit) break
      rects.push({ x, y, width: boxWidth, height })
    }
    return rects
  }
  /** Over the label, from the nearest, never past the text above it. */
  function above({ x, width: boxWidth }: Span, height: number) {
    const span = { x, y: 0, width: boxWidth, height: 0 }
    const ceiling = Math.max(top, ...text.filter((o) => bottom(o) <= label.y && acrossFrom(o, span)).map(bottom))
    const rects: Rect[] = []
    for (let gap = height < 40 ? 2 : 4; gap <= 80; gap += 2) {
      const y = label.y - gap - height
      if (y < ceiling) break
      rects.push({ x, y, width: boxWidth, height })
    }
    return rects
  }
  /** The nearest places first, then the ones closest to the label's middle. */
  const byGap = (lists: Rect[][]) =>
    Array.from({ length: Math.max(0, ...lists.map((l) => l.length)) }, (_, i) =>
      lists.flatMap((l) => l[i] ?? [])
    ).flat()

  function* places(): Generator<Rect> {
    // A signature line under the label, or after it on its line: the box stands on it, below whatever is above it.
    for (const line of page.underlines) {
      const under =
        line.y >= middle(label) && line.y <= label.foot + PAD + 60 && line.x < label.right && right(line) > label.left
      const beside =
        Math.abs(middle(line) - middle(label)) < 0.4 * Math.max(line.height, label.size) &&
        line.x >= right(label) - 1 &&
        line.x < label.edgeRight
      if (!under && !beside) continue
      const base = line.y + line.height * 1.1
      // As wide as the line, within the column.
      const start = under ? line.x : Math.max(line.x, right(label) + PAD + 1)
      const space = under ? width : Math.min(BOX_PT.width, label.edgeRight - start)
      const boxWidth = Math.min(Math.max(right(line) - start, 120), space)
      const x = under ? columnX(line.x + line.width / 2, boxWidth) : start
      const over = obstacles.filter((o) => o.x < x + boxWidth && right(o) > x && bottom(o) <= base + 1)
      const y = Math.max(base - BOX_PT.height, ...over.map((o) => bottom(o) + 1))
      if (base - y >= 30 && boxWidth >= 120 && y >= top && base <= floor)
        yield { x, y, width: boxWidth, height: base - y }
    }
    for (const [spans, heights] of [
      [inColumn, TALL],
      [shifted, TALL],
      [inColumn, SHORT],
      [shifted, SHORT],
    ] as const) {
      for (const height of heights) yield* byGap(spans.map((span) => below(span, height)))
      for (const height of heights) yield* byGap(spans.map((span) => above(span, height)))
    }
    // Past the text under the label: clear, but further from it.
    for (const height of TALL) yield* below(inColumn[0], height, true)
  }

  let best: { rect: Rect; cost: number } | null = null
  for (const rect of places()) {
    if (covered(rect, hard) > 0) continue
    const cost = covered(rect, soft)
    if (cost === 0) return { rect, clear: true }
    if (!best || cost < best.cost) best = { rect, cost }
  }
  return {
    rect: best?.rect ?? { x: inColumn[0].x, y: Math.min(label.foot + 4, floor - 44), width, height: 44 },
    clear: false,
  }
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

/**
 * The labels of a page that are signature spots, in reading order: standing on their own, a bare role only on a line
 * of labels, not signed yet, and with room to sign.
 */
function labelsOf(page: PageText) {
  return page.segments
    .filter(
      (s): s is Segment & { label: Label } =>
        s.label !== null &&
        standsAlone(page, s) &&
        (!s.label.bare || amongLabels(page, s)) &&
        !signedUnder(page, s) &&
        clearPlacement(s, page, []).clear
    )
    .sort((a, b) => a.line - b.line || a.x - b.x)
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
    for (const segment of labelsOf(page)) {
      const { key, role } = segment.label
      const occurrence = seen.get(key) ?? 0
      seen.set(key, occurrence + 1)
      const { rect } = clearPlacement(segment, page, taken)
      taken.push(rect)
      const id = `${key}-${occurrence}`
      const spot = spots.get(id) ?? { id, key, role, places: [] }
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
 * Where a signer with a typed role signs: under a label naming the role, else under a short line naming it ("Per
 * l'Associazione, il Presidente"), the last first, as signatures come at the end. Only in clear space, avoiding text
 * and the boxes in `taken`; null when the document names the role nowhere with room to sign.
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
  const lines = readPages(anchors, pages).flatMap((page, index) =>
    page.segments.filter((s) => !s.part && standsAlone(page, s)).map((segment) => ({ page, index, segment }))
  )
  const labels = lines.filter(
    ({ page, segment }) =>
      key !== undefined && segment.label?.key === key && (!segment.label.bare || amongLabels(page, segment))
  )
  const named = lines.filter(
    ({ segment }) => !segment.label && !segment.text.trim().endsWith(".") && namesRole(fold(segment.text), words)
  )
  for (const { page, index, segment } of [...labels.reverse(), ...named.reverse()]) {
    const boxes = taken.filter((p) => p.page === index).map((p) => toRect(p, page.size))
    const { rect, clear } = clearPlacement(segment, page, boxes)
    if (clear) return toPlacement(rect, index, page.size)
  }
  return null
}

/**
 * Where signers without a label sign, in their order: clear space at the foot of the last page, taken from its
 * bottom row up and each row from the right, then handed out top to bottom and left to right, so the boxes read in
 * signing order. One signer gets the bottom right corner, two share the bottom row. Corner slots when the page is full.
 */
export function defaultPlaces(
  anchors: TextAnchor[],
  pages: PageSize[],
  taken: BoxPlacement[],
  count: number
): BoxPlacement[] {
  const index = Math.max(pages.length - 1, 0)
  const size = pages[index] ?? { width: 595, height: 842 }
  const page = readPage(
    anchors.filter((a) => a.page === index),
    size
  )
  const boxes = taken.filter((p) => p.page === index).map((p) => toRect(p, size))
  // Away from labels a box needn't sit close to the text: a little more room reads calmer.
  const obstacles = [...page.segments.map(room), ...page.sideways, ...page.signatures, ...boxes].map((o) => grow(o, 4))
  const { width, height } = BOX_PT
  const marginX = size.width * 0.07
  const marginY = size.height * 0.07
  const gap = 12
  const slots: Rect[] = []
  for (let y = size.height - marginY - height; y >= marginY && slots.length < count;) {
    const row: Rect[] = []
    for (let x = size.width - marginX - width; x >= marginX; x -= 10) {
      const rect = { x, y, width, height }
      if (row.every((r) => x + width + gap <= r.x) && obstacles.every((o) => overlap(rect, o) === 0)) row.push(rect)
    }
    slots.push(...row.slice(0, count - slots.length))
    y -= row.length > 0 ? height + gap : 4
  }
  for (let slot = boxes.length + slots.length; slots.length < count; slot++) {
    const row = Math.floor(slot / 2)
    slots.push({
      x: slot % 2 === 0 ? size.width - marginX - width : marginX,
      y: Math.max(marginY, size.height - marginY - height - row * (height + 0.03 * size.height)),
      width,
      height,
    })
  }
  return slots.sort((a, b) => a.y - b.y || a.x - b.x).map((rect) => toPlacement(rect, index, size))
}

/**
 * `auto`: placed by the composer, and moved by it until the user moves it: in the default place, laid out again with
 * the other signers there as people are added ("default"), or under the label the typed role names ("label"). Either
 * follows the typed role.
 */
export type DraftPlace = Place & { auto?: "default" | "label" }

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

export function freeRow(
  person: NonNullable<SignerDraft["person"]>,
  role: string,
  box: BoxPlacement,
  auto: NonNullable<DraftPlace["auto"]>
): SignerDraft {
  return { id: `person:${person.sub}`, spot: null, person, role, places: [{ ...box, kind: "signature", auto }] }
}

/**
 * The signers on a document just read. A person keeps a spot of their role when the document has one (the spot they
 * had, or the label their typed role names); the others get a box under their role's label, or in the default place.
 * They keep their order, and the spots nobody fills follow as empty rows.
 *
 * `keepPlaces` is for the same document read again, such as a request sent again: a person in a spot keeps their
 * marks and their signatures on pages without the label, and a person whose role names no label keeps their places,
 * while the document still has those pages.
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
  const onPage = (p: BoxPlacement) => p.page < pages.length
  /** Rows waiting for the default place, laid out together once the others are placed. */
  type Waiting = Pick<SignerDraft, "role"> & { person: NonNullable<SignerDraft["person"]> }
  const placed: (SignerDraft | Waiting)[] = []
  for (const { person, spot, role, places } of rows) {
    if (!person) continue
    const key = spot?.key ?? roleKey(role)?.key
    const at = open.findIndex((s) => s.key === key)
    if (at >= 0) {
      const [own] = open.splice(at, 1)
      const kept = keepPlaces
        ? places.filter(
            (p) => !p.auto && onPage(p) && (p.kind === "mark" || !own.places.some((s) => s.page === p.page))
          )
        : []
      taken.push(...kept)
      placed.push({ ...spotRow(own, person), places: [...own.places, ...kept] })
      continue
    }
    const underRole = placeUnderRole(role, anchors, pages, taken)
    if (underRole) {
      taken.push(underRole)
      placed.push(freeRow(person, role, underRole, "label"))
    } else if (keepPlaces && places.length > 0 && places.every(onPage)) {
      taken.push(...places)
      placed.push({ id: `person:${person.sub}`, spot: null, person, role, places })
    } else placed.push({ person, role })
  }
  const boxes = defaultPlaces(anchors, pages, taken, placed.filter((r) => !("places" in r)).length)
  let next = 0
  return [
    ...placed.map((r) => ("places" in r ? r : freeRow(r.person, r.role, boxes[next++], "default"))),
    ...open.map((spot) => spotRow(spot, null)),
  ]
}
