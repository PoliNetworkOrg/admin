import { createFileRoute, redirect } from "@tanstack/react-router"

import { RouteNotFound } from "@/components/route-error"
import { canOpenPage, DashboardShell, documentTitle, matchPath, NO_PEOPLE_ROLES } from "@/components/shell"
import { getDashboardAccess } from "@/features/auth/auth.functions"
import { getPendingGroupLinkReports } from "@/features/group-link-reports/reports.functions"
import { getReceipts } from "@/features/people/people-receipts.functions"
import { getLinkingReviews, getMyPeopleRoles } from "@/features/people/people.functions"
import { signInRedirect } from "@/lib/sign-in"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard")({
  // Signed in, then `admin:access` or `people:self` from `me.access` (RFC v3 §11.3). The permissions and the roles
  // from the person's People record go into the route context for `useCan` and the navigation; pages the user can't
  // open send them to their own area. The backend enforces every call regardless.
  beforeLoad: async ({ location }) => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw signInRedirect(location.href)
    if (access.status === "forbidden") throw redirect({ to: "/unauthorized" })
    const peopleRoles = hasPermission(access.permissions, "people:self")
      ? await getMyPeopleRoles().catch((error) => {
          console.error(error)
          return NO_PEOPLE_ROLES
        })
      : NO_PEOPLE_ROLES
    if (!canOpenPage(matchPath(location.pathname), access.permissions, peopleRoles)) {
      throw redirect({
        to: hasPermission(access.permissions, "people:self") ? "/dashboard/account/me" : "/unauthorized",
      })
    }
    return { user: access.user, permissions: access.permissions, peopleRoles }
  },
  // Not awaited: the panel count streams in. It is decoration, so a failed load hides it; the Reports page reports
  // the error. `router.invalidate()` (e.g. after resolving a report) refreshes it. Reading reports needs the same
  // permission as managing them.
  loader: ({ context }) => ({
    pendingReports: hasPermission(context.permissions, "web:reports:manage")
      ? getPendingGroupLinkReports().then(
          (reports) => reports.length,
          (error) => {
            console.error(error)
            return null
          }
        )
      : Promise.resolve(null),
    needsReview: hasPermission(context.permissions, "people:read")
      ? getLinkingReviews().then(
          (reviews) => reviews.length,
          (error) => {
            console.error(error)
            return null
          }
        )
      : Promise.resolve(null),
    toSign: hasPermission(context.permissions, "people:receipts:sign")
      ? getReceipts({ data: { year: null } }).then(
          (page) =>
            page.viewerSigner
              ? page.receipts.filter((receipt) => receipt.status === "toSign" && receipt.signer === page.viewerSigner)
                  .length
              : null,
          (error) => {
            console.error(error)
            return null
          }
        )
      : Promise.resolve(null),
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
  const { pendingReports, needsReview, toSign } = Route.useLoaderData()
  return <DashboardShell user={user} pendingReports={pendingReports} needsReview={needsReview} toSign={toSign} />
}
