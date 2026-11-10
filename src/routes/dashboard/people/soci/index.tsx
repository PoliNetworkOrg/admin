import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { RegisterPage } from "@/features/soci/register-page"
import { getSociRegister } from "@/features/soci/soci.functions"

export const Route = createFileRoute("/dashboard/people/soci/")({
  loader: () => getSociRegister(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading the register…" />
      </PageContent>
    </>
  ),
  component: RegisterRoute,
})

function RegisterRoute() {
  const { register, unregistered } = Route.useLoaderData()
  return <RegisterPage register={register} unregistered={unregistered} />
}
