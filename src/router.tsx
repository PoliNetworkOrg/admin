import { createRouter } from "@tanstack/react-router"

import { RouteError, RouteNotFound } from "@/components/route-error"
import type { Place } from "@/features/esign/places"

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
  interface HistoryState {
    /** "Sign n together": the boxes moved on the request page, by request id, so the batch keeps them. */
    esignMoved?: Record<string, Place[]>
  }
}
