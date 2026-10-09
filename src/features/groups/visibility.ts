export const VISIBILITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
] as const

export type VisibilityFilter = (typeof VISIBILITY_FILTERS)[number]["value"]

const VISIBILITY_VALUES = ["all", "visible", "hidden"] as const satisfies readonly VisibilityFilter[]

/** The `?visibility=` search param; an unknown value falls back to the default instead of failing the route. */
export function parseVisibility(value: string | undefined): VisibilityFilter | undefined {
  return VISIBILITY_VALUES.find((option) => option === value)
}

export function matchesVisibility(hide: boolean, visibility: VisibilityFilter) {
  return visibility === "all" || hide === (visibility === "hidden")
}

/**
 * The visibility segments with each option's total, like every segmented filter (Grants, Projects, Reports): counts
 * cover all groups, ignoring search and label filters, so they stay put while the list narrows.
 */
export function visibilityItems(groups: readonly { hide: boolean }[]) {
  const hidden = groups.filter((group) => group.hide).length
  const counts = { all: groups.length, visible: groups.length - hidden, hidden }
  return VISIBILITY_FILTERS.map((item) => ({ ...item, count: counts[item.value] }))
}
