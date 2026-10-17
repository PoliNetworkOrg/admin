import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { CategoriesPage } from "@/features/groups-by-label/categories-page"

export const Route = createFileRoute("/dashboard/web/groups-by-label/")({
  loader: async () => {
    const [labels, groups] = await Promise.all([listGroupLabels(), listGroupsWithLabels()])
    return { labels, groups }
  },
  pendingComponent: CategoriesPending,
  component: CategoriesRoute,
})

function CategoriesPending() {
  return (
    <>
      <PageBar width="wide" />
      <PageContent width="wide">
        <CardsSkeleton count={2} label="Loading categories…" />
      </PageContent>
    </>
  )
}

/** The top of the category tree: picks Didattica or Extra to drill into, no groups of its own. */
function CategoriesRoute() {
  const { labels, groups } = Route.useLoaderData()
  return <CategoriesPage labels={labels} groups={groups} />
}
