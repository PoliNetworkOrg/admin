import {
  formatLabelBreadcrumb,
  formatLabelSegment,
  isCategoryLabel,
  isReleaseLabel,
} from "@/features/group-labels/label-tree"

export type LabelKind = "category" | "attribute" | "publication"

export function labelKind(label: string): LabelKind {
  if (isCategoryLabel(label)) return "category"
  if (isReleaseLabel(label)) return "publication"
  return "attribute"
}

/**
 * A publication tag without its `release-` prefix: runs of digits stay joined by hyphens, words are
 * humanized. "release-2026-27" → "2026-27", "release-matricole-2026" → "Matricole 2026".
 */
export function publicationName(tag: string): string {
  const words = tag
    .replace(/^release-/i, "")
    .split("-")
    .filter(Boolean)
  const parts: string[] = []
  words.forEach((word, index) => {
    const numeric = /^\d+$/.test(word)
    if (numeric && index > 0 && /^\d+$/.test(words[index - 1])) parts[parts.length - 1] += `-${word}`
    else parts.push(numeric ? word : formatLabelSegment(word))
  })
  return parts.join(" ") || tag
}

/** How any label reads on its own: breadcrumb for categories, publication name, humanized attribute. */
export function labelDisplayName(label: string): string {
  const kind = labelKind(label)
  if (kind === "category") return formatLabelBreadcrumb(label)
  if (kind === "publication") return publicationName(label)
  return formatLabelSegment(label)
}
