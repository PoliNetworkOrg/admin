import { createFileRoute } from "@tanstack/react-router"

import { ReportsPage } from "@/features/bot/reports-page"
import { MOCK_REPORTS } from "@/features/bot/reports.mock"

export const Route = createFileRoute("/dashboard/bot/reports")({
  component: () => <ReportsPage entries={MOCK_REPORTS} />,
})
