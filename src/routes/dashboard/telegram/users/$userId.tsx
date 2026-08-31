import { createFileRoute, notFound } from "@tanstack/react-router"

import { DetailPageSkeleton } from "@/components/loading-skeleton"
import { TelegramUserProfile } from "@/features/telegram/user-detail/profile"
import { UserDetailBackLink } from "@/features/telegram/user-detail/sections"
import { getTelegramUserDetails } from "@/features/telegram/users.functions"
import { hasWriteAdminRole } from "@/server/authorization"

export const Route = createFileRoute("/dashboard/telegram/users/$userId")({
  loader: ({ params }) => {
    const userId = Number(params.userId)
    if (!Number.isInteger(userId) || userId <= 0) throw notFound()
    return getTelegramUserDetails({ data: { userId } })
  },
  pendingComponent: DetailPageSkeleton,
  component: UserProfileRoute,
})

function UserProfileRoute() {
  const data = Route.useLoaderData()
  const { roles } = Route.useRouteContext()
  return (
    <div className="animate-appear">
      <UserDetailBackLink />
      <TelegramUserProfile data={data} canWrite={hasWriteAdminRole(roles)} />
    </div>
  )
}
