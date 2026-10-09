import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { listGroupLabels } from "@/features/group-labels/group-labels.functions"
import { CategoriesPage } from "@/features/groups-by-label/categories-page"

export const Route = createFileRoute("/dashboard/web/groups-by-label/")({
  loader: () => listGroupLabels(),
  pendingComponent: CategoriesPending,
  component: CategoriesRoute,
})

function CategoriesPending() {
  return (
    <PageContent width="wide">
      <CardsSkeleton count={2} label="Loading categories…" />
    </PageContent>
  )
}

/** The top of the category tree: picks Didattica or Extra to drill into, no groups of its own. */
function CategoriesRoute() {
  return <CategoriesPage labels={Route.useLoaderData()} />
}
