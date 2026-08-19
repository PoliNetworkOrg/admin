import { createFileRoute } from "@tanstack/react-router"
import { AccountPage } from "@/features/account/account-page"

export const Route = createFileRoute("/dashboard/account")({
  component: AccountRoute,
})

function AccountRoute() {
  const { roles, session } = Route.useRouteContext()
  return <AccountPage initialSession={session} telegramRoles={roles} />
}
