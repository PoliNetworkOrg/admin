import { createFileRoute } from "@tanstack/react-router"
import { ScrollText } from "lucide-react"

import { EmptyState } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"

export const Route = createFileRoute("/dashboard/audit-log/")({
  component: AuditLogRoute,
})

function AuditLogRoute() {
  return (
    <>
      <PageBar description="Who changed what across PoliNetwork, and when" />
      <PageContent>
        <EmptyState
          icon={ScrollText}
          title="No events yet"
          text="Every change made across PoliNetwork will appear here, with its author, target, reason and outcome."
        />
      </PageContent>
    </>
  )
}
