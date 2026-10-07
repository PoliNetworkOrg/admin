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
