import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import { hasWebAdminRole } from "@/server/authorization"

export const Route = createFileRoute("/dashboard/web")({
  beforeLoad: ({ context }) => {
    if (!hasWebAdminRole(context.roles)) throw redirect({ to: "/onboarding/unauthorized" })
  },
  component: Outlet,
})
