import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { FreshmanPage } from "@/features/freshman/freshman-page"
import { getGuides } from "@/features/guides/guides.functions"

export const Route = createFileRoute("/dashboard/web/freshman")({
  validateSearch: z.object({ tab: z.enum(["resources", "telegram", "faqs", "guide"]).optional() }),
  loaderDeps: ({ search }) => ({ guide: search.tab === "guide" }),
  loader: async ({ deps }) => ({ guides: deps.guide ? await getGuides() : null }),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={3} rows={4} label="Loading editions…" />
      </PageContent>
    </>
  ),
  component: FreshmanRoute,
})

function FreshmanRoute() {
  const { tab } = Route.useSearch()
  const { guides } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  return (
    <FreshmanPage
      tab={tab ?? "resources"}
      guides={guides}
      onTabChange={(next) => void navigate({ search: { tab: next === "resources" ? undefined : next } })}
    />
  )
}
