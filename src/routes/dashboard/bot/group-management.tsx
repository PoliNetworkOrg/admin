import { createFileRoute } from "@tanstack/react-router"

import { GroupManagementPage } from "@/features/bot/group-management-page"
import { MOCK_GROUP_MANAGEMENT_LOG } from "@/features/bot/group-management.mock"

export const Route = createFileRoute("/dashboard/bot/group-management")({
  component: () => <GroupManagementPage entries={MOCK_GROUP_MANAGEMENT_LOG} />,
})
