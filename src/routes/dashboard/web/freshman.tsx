import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { listFAQs } from "@/features/faqs/faqs.functions"
import { FreshmanPage } from "@/features/freshman/freshman-page"
import { FreshmanTabs } from "@/features/freshman/freshman-tabs"
import { getFreshmanContent } from "@/features/freshman/freshman.functions"
import { GuidesPage } from "@/features/guides/guides-page"
import { getGuides } from "@/features/guides/guides.functions"

export const Route = createFileRoute("/dashboard/web/freshman")({
  validateSearch: z.object({ tab: z.enum(["resources", "telegram", "faqs", "guide"]).optional() }),
  loaderDeps: ({ search }) => ({ tab: search.tab ?? "resources" }),
  loader: async ({ deps }) => {
    if (deps.tab === "guide") return { tab: deps.tab, guides: await getGuides() } as const
    const [content, categories] = await Promise.all([
      getFreshmanContent(),
      deps.tab === "faqs" ? listFAQs() : Promise.resolve([]),
    ])
    return { tab: deps.tab, content, catalog: categories.flatMap((category) => category.faqs) } as const
  },
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={3} rows={4} label="Loading freshman content…" />
      </PageContent>
    </>
  ),
  component: FreshmanRoute,
})

function FreshmanRoute() {
  const { tab } = Route.useSearch()
  const data = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const navigation = (
    <FreshmanTabs
      tab={tab ?? "resources"}
      onTabChange={(next) => void navigate({ search: { tab: next === "resources" ? undefined : next } })}
    />
  )
  if (data.tab === "guide") return <GuidesPage guides={data.guides} navigation={navigation} />
  return <FreshmanPage tab={data.tab} content={data.content} catalog={data.catalog} navigation={navigation} />
}
