import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware } from "@/server/auth.middleware"

import type { OverviewCounts } from "./overview-page"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function countOf<T>(result: PromiseSettledResult<T>, count: (value: T) => number): number | null {
  if (result.status === "fulfilled") return count(result.value)
  console.error(result.reason)
  return null
}

/** Aggregate on the server so the landing page receives counts instead of entire directories. */
export const getOverviewCounts = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }): Promise<OverviewCounts> => {
    const backend = context.backend
    const [groups, users, reports, grants, azure] = await Promise.allSettled([
      backend.tg.groups.getAll.query(),
      backend.tg.users.getAll.query().then((result) => {
        if (result.error) throw new Error(result.error)
        return result.users ?? []
      }),
      backend.web.reports.list.query({ statuses: ["pending"] }),
      backend.tg.grants.getOngoing.query(),
      backend.azure.groups.getAll.query(),
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
      smallM365Groups: countOf(azure, (all) => all.filter((group) => group.members.length <= 1).length),
    }
  })
