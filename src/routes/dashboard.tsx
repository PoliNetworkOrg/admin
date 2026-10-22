import { createFileRoute, redirect } from "@tanstack/react-router"

import { RouteNotFound } from "@/components/route-error"
import { DashboardShell, documentTitle, matchPath } from "@/components/shell"
import { getDashboardAccess } from "@/features/auth/auth.functions"
import { getEsignPendingCount } from "@/features/esign/esign.functions"
import { EsignSigningHost } from "@/features/esign/signing-host"
import { getPendingGroupLinkReports } from "@/features/group-link-reports/reports.functions"
import { signInRedirect } from "@/lib/sign-in"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard")({
  // Signed in, then `admin:access` from `me.access` (RFC v3 §11.3). The permissions go into the route context for
  // `useCan`; the backend enforces them on every call regardless.
  beforeLoad: async ({ location }) => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw signInRedirect(location.href)
    if (access.status === "forbidden") throw redirect({ to: "/unauthorized" })
    return { user: access.user, permissions: access.permissions }
  },
  // Not awaited: the panel count streams in. It is decoration, so a failed load hides it; the Reports page reports
  // the error. `router.invalidate()` (e.g. after resolving a report) refreshes it. Reading reports needs the same
  // permission as managing them.
  loader: ({ context }) => ({
    pending: {
      reports: hasPermission(context.permissions, "web:reports:manage")
        ? getPendingGroupLinkReports().then(
            (reports) => reports.length,
            (error) => {
              console.error(error)
              return null
            }
          )
        : Promise.resolve(null),
      // Documents waiting for the user's signature: a dot on Signatures and a count on To sign.
      signatures: hasPermission(context.permissions, "esign:sign")
        ? getEsignPendingCount().then(
            (count) => count,
            (error) => {
              console.error(error)
              return null
            }
          )
        : Promise.resolve(null),
    },
  }),
  staleTime: 60_000,
  // One title for every dashboard page, from the deepest match: "{Section} - {Service} - PoliNetwork Admin".
  head: ({ matches }) => ({ meta: [{ title: documentTitle(matchPath(matches.at(-1)?.pathname ?? "/dashboard")) }] }),
  // Unknown `/dashboard/…` URLs render in the shell's content column; a failure in this route's own `beforeLoad` or
  // loader has no shell yet, so the same component centres itself on the page.
  notFoundComponent: RouteNotFound,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const { pending } = Route.useLoaderData()
  // A signature from New request or a batch keeps its dialog while the page it lands on loads.
  return (
    <EsignSigningHost>
      <DashboardShell user={user} pending={pending} />
    </EsignSigningHost>
  )
}
