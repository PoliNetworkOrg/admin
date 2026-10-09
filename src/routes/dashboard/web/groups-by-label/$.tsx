import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import {
  listGroupLabels,
  listGroupsForLabels,
  listGroupsWithLabels,
} from "@/features/group-labels/group-labels.functions"
import { urlSegmentsToLabelPath } from "@/features/group-labels/label-tree"
import { CategoryPage } from "@/features/groups-by-label/category-page"

export const Route = createFileRoute("/dashboard/web/groups-by-label/$")({
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      listGroupsForLabels(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { ...groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: CategoryPending,
  component: CategoryRoute,
})

function CategoryPending() {
  return (
    <PageContent width="wide">
      <RecordSkeleton label="Loading category…" />
    </PageContent>
  )
}

function CategoryRoute() {
  const { _splat } = Route.useParams()
  const { tgGroups, groupLabels, groupsWithLabels } = Route.useLoaderData()
  const path = urlSegmentsToLabelPath((_splat ?? "").split("/"))

  return <CategoryPage key={path} path={path} labels={groupLabels} groups={groupsWithLabels} tgGroups={tgGroups} />
}
