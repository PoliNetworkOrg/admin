import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware } from "@/server/auth.middleware"
import { hasPermission, type Permission } from "@/server/permissions"

import type { OverviewCount, OverviewCounts } from "./overview-page"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** `undefined` when the user lacks the permission, so the overview hides the count instead of reporting a failure. */
function countOf<T>(result: PromiseSettledResult<T | undefined>, count: (value: T) => number): OverviewCount {
  if (result.status === "rejected") {
    console.error(result.reason)
    return null
  }
  return result.value === undefined ? undefined : count(result.value)
}

/** Aggregate on the server so the landing page receives counts instead of entire directories. */
export const getOverviewCounts = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }): Promise<OverviewCounts> => {
    const { backend, permissions } = context
    const ifAllowed = <T>(permission: Permission, load: () => Promise<T>) =>
      hasPermission(permissions, permission) ? load() : Promise.resolve(undefined)
    const [groups, users, reports, grants] = await Promise.allSettled([
      backend.tg.groups.getAll.query(),
      ifAllowed("tg:users:read", () =>
        backend.tg.users.getAll.query().then((result) => {
          if (result.error) throw new Error(result.error)
          return result.users ?? []
        })
      ),
      ifAllowed("web:reports:manage", () => backend.web.reports.list.query({ statuses: ["pending"] })),
      ifAllowed("tg:grants:read", () => backend.tg.grants.getOngoing.query()),
    ])
    const now = Date.now()
    return {
      telegramGroups: countOf(groups, (all) => all.length),
      hiddenGroups: countOf(groups, (all) => all.filter((group) => group.hide).length),
      telegramUsers: countOf(users, (all) => all.length),
      openReports: countOf(reports, (all) => all.length),
      activeGrants: countOf(grants, (ongoing) => ongoing.grants.length),
      expiringGrants: countOf(
        grants,
        (ongoing) =>
          ongoing.grants.filter(({ grant }) => {
            const remaining = new Date(grant.validUntil).getTime() - now
            return remaining >= 0 && remaining <= WEEK_MS
          }).length
      ),
    }
  })
