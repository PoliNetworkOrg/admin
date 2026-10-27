import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/dashboard/web/guides")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/web/freshman", search: { tab: "guide" }, replace: true })
  },
})
