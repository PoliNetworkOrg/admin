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
