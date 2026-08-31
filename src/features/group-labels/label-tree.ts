import type { GroupLabel } from "./types"

/**
 * The two fixed, structural containers for the browsable category hierarchy (school/level/course/year, or the
 * extra-groups branch) — e.g. "didattica.design.triennale" or "extra.affitti". Everything else (language/campus
 * facets like "ita", "eng", "bovisa") is a flat attribute tag attached to individual groups, not part of this
 * tree. These roots are deliberately not admin-creatable: without a backend "kind" column there's no way to tell
 * an empty category-root-in-waiting apart from a flat tag, so the distinction is made *by construction* — a new
 * category is always created nested under one of these two, a new tag is always created bare.
 */
export const CATEGORY_ROOTS = ["didattica", "extra"]

export function isCategoryLabel(label: string): boolean {
  return CATEGORY_ROOTS.some((root) => label === root || label.startsWith(`${root}.`))
}

/** True when `name` collides with a fixed category root — reserved so a tag or rename can never shadow one. */
export function isReservedCategoryRoot(name: string): boolean {
  const normalized = name.trim().toLocaleLowerCase()
  return CATEGORY_ROOTS.some((root) => root === normalized)
}

/** A path segment is embedded directly in the groups-by-label route, so it must not contain URL separators. */
export function isValidLabelSegment(segment: string): boolean {
  return segment.length > 0 && !/[./\\?#%]/.test(segment)
}

/** Humanizes a single path segment for display, e.g. "primo-anno" -> "Primo Anno". */
export function formatLabelSegment(segment: string): string {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(" ")
}

/** Renders a dotted path as a readable breadcrumb, e.g. "didattica.design" -> "Didattica › Design". */
export function formatLabelBreadcrumb(path: string): string {
  return labelPathToUrlSegments(path).map(formatLabelSegment).join(" › ")
}

/**
 * Humanizes a category path for a compact chip: its last two segments, e.g. "didattica.design.triennale" ->
 * "Design › Triennale". A single trailing segment alone is often low-information (e.g. an academic year like
 * "26-27" tacked onto the end of a category), so two segments give a chip enough context to be useful on its own.
 */
export function formatLabelCompact(path: string): string {
  return labelPathToUrlSegments(path).slice(-2).map(formatLabelSegment).join(" › ")
}

/** Picks the right compact display for any label, category or tag, without the caller needing to branch. */
export function formatLabelChip(path: string): string {
  return isCategoryLabel(path) ? formatLabelCompact(path) : formatLabelSegment(path)
}

export type LabelTreeNode = {
  segment: string
  path: string
  label: GroupLabel | null
  children: LabelTreeNode[]
}

/** Splits each label on "." to derive a hierarchy; segments with no matching label are pure grouping nodes. */
export function buildLabelTree(labels: GroupLabel[]): LabelTreeNode[] {
  const nodesByPath = new Map<string, LabelTreeNode>()
  const roots: LabelTreeNode[] = []

  function getOrCreateNode(segments: string[]): LabelTreeNode {
    const path = segments.join(".")
    const existing = nodesByPath.get(path)
    if (existing) return existing

    const node: LabelTreeNode = { segment: segments[segments.length - 1] ?? "", path, label: null, children: [] }
    nodesByPath.set(path, node)

    if (segments.length === 1) roots.push(node)
    else getOrCreateNode(segments.slice(0, -1)).children.push(node)

    return node
  }

  for (const label of labels) {
    const segments = label.label.split(".").filter((segment: string) => segment.length > 0)
    if (!segments.length) continue
    getOrCreateNode(segments).label = label
  }

  function sortNodes(nodes: LabelTreeNode[]) {
    nodes.sort((a, b) => a.segment.localeCompare(b.segment))
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)

  return roots
}

/** Like `buildLabelTree`, but guarantees both fixed category roots always appear (as empty placeholders if
 * they have no labels yet), so the management page always has somewhere to add the first category under. */
export function buildCategoryRootTree(categoryLabels: GroupLabel[]): LabelTreeNode[] {
  const nodesByPath = new Map(buildLabelTree(categoryLabels).map((node) => [node.path, node]))
  return CATEGORY_ROOTS.map((root) => nodesByPath.get(root) ?? { segment: root, path: root, label: null, children: [] })
}

/** Finds the node at `path` within a tree, walking down one segment at a time instead of searching blindly. */
export function findLabelTreeNode(nodes: LabelTreeNode[], path: string): LabelTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    if (path.startsWith(`${node.path}.`)) return findLabelTreeNode(node.children, path)
  }
  return undefined
}

/** Converts a hierarchy path ("informatica.triennale") to its sidebar URL segments. */
export function labelPathToUrlSegments(path: string): string[] {
  return path.split(".").filter((segment) => segment.length > 0)
}

/** Converts sidebar URL segments back to a dotted hierarchy path — the inverse of `labelPathToUrlSegments`,
 * so a malformed URL (trailing/double slash) can't produce a path with an empty segment (e.g. a trailing dot). */
export function urlSegmentsToLabelPath(segments: string[]): string {
  return segments.filter((segment) => segment.length > 0).join(".")
}

/** A group matches a branch when one of its labels is exactly `path`, or nested under it (e.g. "informatica.triennale.primo" under "informatica"). */
export function matchesLabelBranch(groupLabels: GroupLabel[], path: string): boolean {
  return groupLabels.some((label) => label.label === path || label.label.startsWith(`${path}.`))
}

/** A group has this exact category — unlike `matchesLabelBranch`, a group nested one level deeper doesn't count. */
export function hasExactLabel(groupLabels: GroupLabel[], path: string): boolean {
  return groupLabels.some((label) => label.label === path)
}

/**
 * Resolves each group's label strings (from the cross-platform `groups.search.getAll` result) to full label
 * objects, for groups of the given platform only — Telegram and WhatsApp group ids are independent sequences
 * that could otherwise collide.
 */
export function buildLabelsByGroupId(
  labels: GroupLabel[],
  groupsWithLabels: { id: number; type: "tg" | "wa"; labels: string[] }[],
  type: "tg" | "wa"
): Map<number, GroupLabel[]> {
  const labelsByName = new Map(labels.map((label) => [label.label, label]))
  const map = new Map<number, GroupLabel[]>()
  for (const group of groupsWithLabels) {
    if (group.type !== type) continue
    const resolved = group.labels.map((name) => labelsByName.get(name)).filter((label) => label != null)
    if (resolved.length) map.set(group.id, resolved)
  }
  return map
}

/** Every real label in a node's own subtree (itself, if it has one, plus all of its descendants). */
export function collectSubtreeLabels(node: LabelTreeNode): GroupLabel[] {
  const labels: GroupLabel[] = []
  if (node.label) labels.push(node.label)
  for (const child of node.children) labels.push(...collectSubtreeLabels(child))
  return labels
}

function nodeSelfMatches(node: LabelTreeNode, normalizedQuery: string): boolean {
  if (node.segment.toLocaleLowerCase().includes(normalizedQuery)) return true
  if (!node.label) return false
  return [node.label.label, node.label.description ?? ""].some((value) =>
    value.toLocaleLowerCase().includes(normalizedQuery)
  )
}

/** Keeps a node when it matches, or when any descendant does, so a matching leaf stays reachable through its ancestors. */
export function filterLabelTree(nodes: LabelTreeNode[], query: string): LabelTreeNode[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return nodes

  const result: LabelTreeNode[] = []
  for (const node of nodes) {
    const filteredChildren = filterLabelTree(node.children, query)
    if (nodeSelfMatches(node, normalizedQuery) || filteredChildren.length) {
      result.push({ ...node, children: filteredChildren })
    }
  }
  return result
}

/** Filters a flat list of tags (no hierarchy) by name or description — the flat-list counterpart of `filterLabelTree`. */
export function filterFlatLabels(labels: GroupLabel[], query: string): GroupLabel[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return labels
  return labels.filter((label) =>
    [label.label, label.description ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  )
}
