import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { EmailTemplatesPage } from "@/features/email-templates/email-templates-page"
import { listEmailTemplates } from "@/features/email-templates/email-templates.functions"
import { hasWriteAdminRole } from "@/server/authorization"

export const Route = createFileRoute("/dashboard/azure/email-templates")({
  loader: () => listEmailTemplates(),
  pendingComponent: () => <DataPageSkeleton columns={2} />,
  component: EmailTemplatesRoute,
})

function EmailTemplatesRoute() {
  const templates = Route.useLoaderData()
  const { roles } = Route.useRouteContext()
  return <EmailTemplatesPage initialTemplates={templates} canWrite={hasWriteAdminRole(roles)} />
}
