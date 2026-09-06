import { createFileRoute } from "@tanstack/react-router"

import { AuditLogPage } from "@/features/bot/audit-log-page"
import { MOCK_AUDIT_LOG } from "@/features/bot/audit-log.mock"

export const Route = createFileRoute("/dashboard/bot/audit-log")({
  component: () => <AuditLogPage entries={MOCK_AUDIT_LOG} />,
})
