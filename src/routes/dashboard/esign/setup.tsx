import { createFileRoute, redirect } from "@tanstack/react-router"

import { EsignSetupPage } from "@/features/esign/setup-page"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/setup")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:sign")) throw redirect({ to: "/unauthorized" })
  },
  component: EsignSetupPage,
})
