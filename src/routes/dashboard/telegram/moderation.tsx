import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { TelegramModerationPage } from "@/features/telegram/moderation-page"
import { getModerationAudits } from "@/features/telegram/moderation.functions"

export const Route = createFileRoute("/dashboard/telegram/moderation")({
  loader: () => getModerationAudits(),
  pendingComponent: () => <DataPageSkeleton columns={7} />,
  component: TelegramModerationRoute,
})

function TelegramModerationRoute() {
  return <TelegramModerationPage audits={Route.useLoaderData()} />
}
