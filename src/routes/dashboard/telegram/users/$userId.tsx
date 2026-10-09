import { createFileRoute, notFound } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { TelegramUserDetailPage, TelegramUserNotFound } from "@/features/telegram/user-detail/profile"
import { getTelegramUserDetails } from "@/features/telegram/users.functions"

export const Route = createFileRoute("/dashboard/telegram/users/$userId")({
  loader: ({ params }) => {
    const userId = Number(params.userId)
    if (!Number.isInteger(userId) || userId <= 0) throw notFound()
    return getTelegramUserDetails({ data: { userId } })
  },
  pendingComponent: UserDetailPending,
  notFoundComponent: UserNotFoundRoute,
  component: UserDetailRoute,
})

function UserDetailPending() {
  const { userId } = Route.useParams()
  return (
    <>
      <PageBar back={{ label: "users", link: { to: "/dashboard/telegram/users" } }} context={userId} contextMono />
      <PageContent width="record">
        <RecordSkeleton label="Loading user…" />
      </PageContent>
    </>
  )
}

function UserNotFoundRoute() {
  const { userId } = Route.useParams()
  return <TelegramUserNotFound userId={userId} />
}

function UserDetailRoute() {
  return <TelegramUserDetailPage data={Route.useLoaderData()} />
}
