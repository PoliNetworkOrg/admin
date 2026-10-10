import { createFileRoute } from "@tanstack/react-router"

import { AccountPage } from "@/features/account/account-page"
import { getIdpAccountUrl } from "@/features/auth/auth.functions"

export const Route = createFileRoute("/dashboard/account")({
  loader: () => getIdpAccountUrl(),
  component: AccountRoute,
})

function AccountRoute() {
  const { user, permissions } = Route.useRouteContext()
  return <AccountPage user={user} permissions={permissions} accountUrl={Route.useLoaderData()} />
}
