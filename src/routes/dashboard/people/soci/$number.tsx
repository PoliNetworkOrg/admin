import { createFileRoute, notFound } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getPeople } from "@/features/people/people.functions"
import { getSociList, getSocio } from "@/features/soci/soci.functions"
import { SocioPage } from "@/features/soci/socio-page"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/people/soci/$number")({
  // People records name who did what (the backend records account IDs), when the viewer may read them.
  loader: async ({ params, context }) => {
    if (!/^[1-9]\d{0,5}$/.test(params.number)) throw notFound()
    const [socio, register, people] = await Promise.all([
      getSocio({ data: { number: Number(params.number) } }),
      getSociList(),
      hasPermission(context.permissions, "people:read")
        ? getPeople().catch((error) => {
            console.error(error)
            return []
          })
        : [],
    ])
    return { socio, register: register.members, people }
  },
  pendingComponent: SocioPending,
  component: SocioRoute,
})

function SocioPending() {
  return (
    <>
      <PageBar width="record" back={{ label: "the register", link: { to: "/dashboard/people/soci" } }} crumb="Soci" />
      <PageContent width="record">
        <RecordSkeleton label="Loading socio…" />
      </PageContent>
    </>
  )
}

function SocioRoute() {
  const { socio, register, people } = Route.useLoaderData()
  return <SocioPage socio={socio} register={register} people={people} />
}
