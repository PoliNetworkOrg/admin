import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, Flag, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { labelPathToUrlSegments } from "@/features/group-labels/label-tree"
import { dismissGroupLinkReport, resolveGroupLinkReport } from "@/features/group-link-reports/reports.functions"
import type { GroupLinkReport } from "@/lib/api/types"

const REPORT_TYPE_LABEL = {
  broken_link: "Broken link",
  missing: "Missing group",
} satisfies Record<GroupLinkReport["reportType"], string>

const TYPE_LABEL = {
  tg: "Telegram",
  wa: "WhatsApp",
} satisfies Record<NonNullable<GroupLinkReport["type"]>, string>

const STATUS_LABEL = {
  pending: "Pending",
  resolved: "Resolved",
  dismissed: "Dismissed",
} satisfies Record<GroupLinkReport["status"], string>

function groupsPageUrl(type: NonNullable<GroupLinkReport["type"]>) {
  return type === "tg" ? "/dashboard/telegram/groups" : "/dashboard/whatsapp/groups"
}

function labelCategoryUrl(label: string) {
  return `/dashboard/web/groups-by-label/${labelPathToUrlSegments(label).join("/")}`
}

function missingLabel(report: GroupLinkReport) {
  return report.label ?? "—"
}

/** Where clicking a report should go: the problematic group itself for a broken link, or the category the
 * missing group belongs to, following its label path. */
function reportTarget(report: GroupLinkReport): { to: string; search?: { q: string } } | null {
  if (report.reportType === "broken_link") {
    if (!report.type) return null
    return { to: groupsPageUrl(report.type), search: report.groupTitle ? { q: report.groupTitle } : undefined }
  }
  if (!report.label) return null
  return { to: labelCategoryUrl(report.label) }
}

type ReportGroup = {
  key: string
  latest: GroupLinkReport
  ids: number[]
  count: number
}

function groupReports(reports: GroupLinkReport[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>()

  for (const report of reports) {
    const key =
      report.reportType === "broken_link" ? `broken_link:${report.type}:${report.groupId}` : `missing:${report.label}`

    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { key, latest: report, ids: [report.id], count: 1 })
      continue
    }

    existing.ids.push(report.id)
    existing.count += 1
    if (new Date(report.createdAt) > new Date(existing.latest.createdAt)) existing.latest = report
  }

  return [...groups.values()].sort(
    (a, b) => new Date(a.latest.createdAt).getTime() - new Date(b.latest.createdAt).getTime()
  )
}

export function GroupLinkReportsPage({
  loadedReports,
  showActions = true,
}: {
  loadedReports: GroupLinkReport[]
  showActions?: boolean
}) {
  const router = useRouter()
  const resolve = useServerFn(resolveGroupLinkReport)
  const dismiss = useServerFn(dismissGroupLinkReport)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const reportGroups = groupReports(loadedReports)

  async function handleAction(group: ReportGroup, action: "resolve" | "dismiss") {
    setPendingKey(group.key)
    try {
      await (action === "resolve" ? resolve({ data: { ids: group.ids } }) : dismiss({ data: { ids: group.ids } }))
      await router.invalidate()
      toast.success(action === "resolve" ? "Report resolved." : "Report dismissed.")
    } catch (error) {
      console.error(error)
      toast.error("The report could not be updated. Check your permissions and try again.")
    } finally {
      setPendingKey(null)
    }
  }

  if (loadedReports.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title={showActions ? "No pending reports" : "No resolved reports"}
        text="Reports of broken Telegram or WhatsApp links, or missing groups, submitted by users will show up here."
      />
    )
  }

  return (
    <TableSurface>
      <Table>
        <TableHeader>
          <TableRow>
            <DataTableHead>Reference</DataTableHead>
            <DataTableHead>Issue</DataTableHead>
            <DataTableHead>Details</DataTableHead>
            {!showActions && <DataTableHead>Status</DataTableHead>}
            <DataTableHead>Date</DataTableHead>
            {showActions && <DataTableHead className="text-right">Actions</DataTableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportGroups.map((group) => {
            const report = group.latest
            const target = reportTarget(report)
            const goToTarget = () => {
              if (target) void router.navigate(target)
            }
            return (
              <TableRow
                key={group.key}
                className={
                  target
                    ? "cursor-pointer outline-none focus-visible:bg-muted/70 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/25"
                    : undefined
                }
                tabIndex={target ? 0 : undefined}
                onClick={target ? goToTarget : undefined}
                onKeyDown={
                  target
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          goToTarget()
                        }
                      }
                    : undefined
                }
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>
                      {report.reportType === "broken_link" ? (report.groupTitle ?? "—") : missingLabel(report)}
                    </span>
                    {group.count > 1 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1">
                        {group.count}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {report.type && <Badge variant="outline">{TYPE_LABEL[report.type]}</Badge>}
                    <span>{REPORT_TYPE_LABEL[report.reportType]}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-80 truncate text-muted-foreground">
                  {report.reportType === "broken_link" ? (report.reportedLink ?? "—") : (report.details ?? "—")}
                </TableCell>
                {!showActions && (
                  <TableCell>
                    <Badge variant={report.status === "resolved" ? "default" : "secondary"}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {new Date(report.createdAt).toLocaleDateString()}
                </TableCell>
                {showActions && (
                  <TableCell className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={pendingKey === group.key}
                      onClick={() => void handleAction(group, "dismiss")}
                    >
                      <X />
                      <span className="sr-only">Dismiss</span>
                    </Button>
                    <Button
                      size="icon-sm"
                      disabled={pendingKey === group.key}
                      onClick={() => void handleAction(group, "resolve")}
                    >
                      <Check />
                      <span className="sr-only">Resolve</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableSurface>
  )
}
