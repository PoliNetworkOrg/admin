import { createFileRoute, redirect } from "@tanstack/react-router"
export const Route = createFileRoute("/dashboard/web/associations")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/associations" })
  },
})
