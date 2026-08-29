import type { GroupLabel } from "./types"

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

/** Converts a hierarchy path ("informatica.triennale") to its sidebar URL segments. */
export function labelPathToUrlSegments(path: string): string[] {
  return path.split(".").filter((segment) => segment.length > 0)
}

/** Converts sidebar URL segments back to a dotted hierarchy path. */
export function urlSegmentsToLabelPath(segments: string[]): string {
  return segments.join(".")
}

/** A group matches a branch when one of its labels is exactly `path`, or nested under it (e.g. "informatica.triennale.primo" under "informatica"). */
export function matchesLabelBranch(groupLabels: GroupLabel[], path: string): boolean {
  return groupLabels.some((label) => label.label === path || label.label.startsWith(`${path}.`))
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
