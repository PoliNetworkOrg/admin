import { createRouter } from "@tanstack/react-router"

import { RouteError, RouteNotFound } from "@/components/route-error"

import { routeTree } from "./routeTree.gen"

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingMs: 100,
    scrollRestoration: true,
    defaultNotFoundComponent: RouteNotFound,
    defaultErrorComponent: RouteError,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
