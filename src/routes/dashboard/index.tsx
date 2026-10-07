import { createFileRoute } from "@tanstack/react-router"

import { getAzureDirectory } from "@/features/azure/azure.functions"
import { DashboardOverviewPage, type OverviewCounts } from "@/features/dashboard/overview-page"
import { getPendingGroupLinkReports } from "@/features/group-link-reports/reports.functions"
import { getTelegramGrants } from "@/features/telegram/grants.functions"
import { getTelegramGroups } from "@/features/telegram/groups.functions"
import { getTelegramUsers } from "@/features/telegram/users.functions"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** A count from a settled load: null when that service failed, so one outage doesn't blank the overview. */
function countOf<T>(result: PromiseSettledResult<T>, count: (value: T) => number): number | null {
  return result.status === "fulfilled" ? count(result.value) : null
}

async function loadOverviewCounts(): Promise<OverviewCounts> {
  const [groups, users, reports, grants, azure] = await Promise.allSettled([
    getTelegramGroups(),
    getTelegramUsers(),
    getPendingGroupLinkReports(),
    getTelegramGrants(),
    getAzureDirectory(),
  ])
  const now = Date.now()
  return {
    telegramGroups: countOf(groups, (all) => all.length),
    hiddenGroups: countOf(groups, (all) => all.filter((group) => group.hide).length),
    telegramUsers: countOf(users, (all) => all.length),
    openReports: countOf(reports, (all) => all.length),
    activeGrants: countOf(grants, ({ ongoing }) => ongoing.grants.length),
    expiringGrants: countOf(
      grants,
      ({ ongoing }) =>
        ongoing.grants.filter(({ grant }) => new Date(grant.validUntil).getTime() - now <= WEEK_MS).length
    ),
    smallM365Groups: countOf(azure, ({ groups: all }) => all.filter((group) => group.members.length <= 1).length),
  }
}

export const Route = createFileRoute("/dashboard/")({
  loader: loadOverviewCounts,
  component: OverviewRoute,
})

function OverviewRoute() {
  return <DashboardOverviewPage counts={Route.useLoaderData()} />
}
