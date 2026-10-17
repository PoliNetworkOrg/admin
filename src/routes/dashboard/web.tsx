import { Outlet, createFileRoute } from "@tanstack/react-router"

/** Every dashboard user may read web content; writes check `web:content:write` and `groups:labels:write`. */
export const Route = createFileRoute("/dashboard/web")({
  component: Outlet,
})
