import { createFileRoute, redirect } from "@tanstack/react-router"

import { getDashboardAccess } from "@/features/auth/auth.functions"
import { TelegramLinkPage } from "@/features/onboarding/telegram-link-page"

export const Route = createFileRoute("/onboarding/link")({
  beforeLoad: async () => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw redirect({ to: "/login" })
    if (access.status === "authorized") throw redirect({ to: "/dashboard" })
    if (access.status === "forbidden") throw redirect({ to: "/onboarding/unauthorized" })
    return { session: access.session }
  },
  component: TelegramLinkRoute,
})

function TelegramLinkRoute() {
  const { session } = Route.useRouteContext()
  return <TelegramLinkPage initialSession={session} />
}
