import { linkOptions, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, CircleCheck, Inbox, X } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import {
  buttonMotion,
  CountBadge,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  PlatformGlyph,
  SegmentedControl,
  StatusBadge,
  Unset,
  useFocusAfterRemoval,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatLabelBreadcrumb, labelPathToUrlSegments } from "@/features/group-labels/label-tree"
import { dismissGroupLinkReport, resolveGroupLinkReport } from "@/features/group-link-reports/reports.functions"
import type { GroupLinkReport } from "@/lib/api/types"
import { formatDate, hostOf } from "@/lib/format"

export type ReportStatus = "open" | "closed"
type Segment = "all" | "tg" | "wa" | "missing" | "resolved" | "dismissed"

const segments = {
  open: [
    { value: "all", label: "All" },
    { value: "tg", label: "Telegram" },
    { value: "wa", label: "WhatsApp" },
    { value: "missing", label: "Missing group" },
  ],
  closed: [
    { value: "all", label: "All" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
  ],
} satisfies Record<ReportStatus, { value: Segment; label: string }[]>

const ISSUE_LABEL = {
  broken_link: "Broken link",
  missing: "Missing group",
} satisfies Record<GroupLinkReport["reportType"], string>

/** One row per broken group or missing label; `latest` supplies the row's text and date. */
type ReportGroup = { key: string; latest: GroupLinkReport; ids: number[] }

function groupKey(report: GroupLinkReport) {
  return report.reportType === "broken_link" ? `broken:${report.type}:${report.groupId}` : `missing:${report.label}`
}

function groupReports(reports: GroupLinkReport[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>()
  for (const report of reports) {
    const key = groupKey(report)
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { key, latest: report, ids: [report.id] })
      continue
    }
    existing.ids.push(report.id)
    if (report.createdAt > existing.latest.createdAt) existing.latest = report
  }
  return [...groups.values()]
}

function inSegment(report: GroupLinkReport, segment: Segment) {
  switch (segment) {
    case "all":
      return true
    case "tg":
    case "wa":
      return report.reportType === "broken_link" && report.type === segment
    case "missing":
      return report.reportType === "missing"
    case "resolved":
    case "dismissed":
      return report.status === segment
  }
}

function reference(report: GroupLinkReport) {
  if (report.reportType === "broken_link") return report.groupTitle
  return report.label ? formatLabelBreadcrumb(report.label) : null
}

/** "t.me/joinchat/abc": the host without "www." plus the path. */
function shortLink(url: string) {
  if (!URL.canParse(url)) return url
  const { pathname } = new URL(url)
  return `${hostOf(url)}${pathname === "/" ? "" : pathname}`
}

function searchText(report: GroupLinkReport) {
  return [
    report.groupTitle,
    report.label,
    report.label && formatLabelBreadcrumb(report.label),
    report.reportedLink,
    report.details,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
}

/** Broken link → the platform's group list searched by title; missing group → the category page. */
function reportTarget(report: GroupLinkReport) {
  if (report.reportType === "missing") {
    if (!report.label) return null
    return linkOptions({
      to: "/dashboard/web/groups-by-label/$",
      params: { _splat: labelPathToUrlSegments(report.label).join("/") },
    })
  }
  const search = report.groupTitle ? { q: report.groupTitle } : {}
  if (report.type === "tg") return linkOptions({ to: "/dashboard/telegram/groups", search })
  if (report.type === "wa") return linkOptions({ to: "/dashboard/whatsapp/groups", search })
  return null
}

const LEAVE_MS = 120

/** Reports › Open and Reports › Closed (docs/design.md §4.8, §7.17). */
export function ReportsPage({ status, reports }: { status: ReportStatus; reports: GroupLinkReport[] }) {
  const open = status === "open"
  const router = useRouter()
  const resolve = useServerFn(resolveGroupLinkReport)
  const dismiss = useServerFn(dismissGroupLinkReport)
  const canWrite = useCanWrite("web")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [segment, setSegment] = useState<Segment>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  /** Rows fading out after Resolve/Dismiss, then rows hidden until the reloaded list drops them. */
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const focus = useFocusAfterRemoval<HTMLDivElement>("tbody tr")

  const matching = useMemo(
    () => (deferredQuery === "" ? reports : reports.filter((report) => searchText(report).includes(deferredQuery))),
    [reports, deferredQuery]
  )
  const groups = groupReports(matching.filter((report) => inSegment(report, segment)))
    .filter((group) => !removed.has(group.key))
    .toSorted((a, b) => {
      const order = a.latest.createdAt.getTime() - b.latest.createdAt.getTime()
      return open ? order : -order
    })
  // Counts individual reports so it matches the panel badge; the ×n badges explain the grouped rows.
  const reportCount = groups.reduce((sum, group) => sum + group.ids.length, 0)
  const totalReports = reports.filter((report) => !removed.has(groupKey(report))).length
  const pageCount = Math.max(1, Math.ceil(groups.length / pageSize))
  // Removing the last row of the last page moves back a page.
  const currentPage = Math.min(page, pageCount)
  const rows = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const filteredView = deferredQuery !== "" || segment !== "all"

  function setKey(setter: typeof setLeaving, key: string, present: boolean) {
    setter((current) => {
      const next = new Set(current)
      if (present) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function settle(group: ReportGroup, action: "resolve" | "dismiss", trigger: HTMLElement) {
    focus.capture(trigger, { restore: true })
    setKey(setLeaving, group.key, true)
    const unmount = window.setTimeout(() => setKey(setRemoved, group.key, true), LEAVE_MS)
    try {
      const input = { data: { ids: group.ids } }
      await (action === "resolve" ? resolve(input) : dismiss(input))
    } catch (caught) {
      console.error(caught)
      window.clearTimeout(unmount)
      setKey(setLeaving, group.key, false)
      setKey(setRemoved, group.key, false)
      appToast.error("Couldn't update the report. Check your permissions and try again.")
      return
    }
    appToast.success(action === "resolve" ? "Report resolved." : "Report dismissed.")
    // Reloads this list and the panel's open-reports count; the row stays hidden until the new list lands.
    await router.invalidate({ sync: true })
    window.clearTimeout(unmount)
    setKey(setLeaving, group.key, false)
    setKey(setRemoved, group.key, false)
  }

  function openReport(group: ReportGroup) {
    const target = reportTarget(group.latest)
    if (target) void router.navigate(target)
  }

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function clearFilters() {
    changeQuery("")
    setSegment("all")
  }

  const columns: DataTableColumn<ReportGroup>[] = [
    {
      id: "reference",
      label: "Reference",
      minWidth: 220,
      fill: true,
      cell: ({ latest, ids }) => {
        const text = reference(latest)
        return (
          <span className="flex min-w-0 items-center gap-2">
            {text ? (
              <span title={text} className="truncate">
                {text}
              </span>
            ) : (
              <Unset />
            )}
            {ids.length > 1 ? <CountBadge value={ids.length} prefix="×" label={`${ids.length} reports`} /> : null}
          </span>
        )
      },
    },
    {
      id: "issue",
      label: "Issue",
      minWidth: 160,
      cell: ({ latest }) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          {latest.reportType === "broken_link" && latest.type ? <PlatformGlyph platform={latest.type} /> : null}
          {ISSUE_LABEL[latest.reportType]}
        </span>
      ),
    },
    {
      id: "details",
      label: "Details",
      priority: 2,
      minWidth: 220,
      cell: ({ latest }) => {
        const link = latest.reportType === "broken_link" ? latest.reportedLink : null
        const text = link ?? latest.details
        if (!text) return <Unset />
        return (
          <span title={text} className="block max-w-[320px] truncate">
            {link ? shortLink(link) : text}
          </span>
        )
      },
    },
    ...(open
      ? []
      : [
          {
            id: "status",
            label: "Status",
            priority: 1,
            minWidth: 120,
            cell: ({ latest }: ReportGroup) =>
              latest.status === "resolved" ? (
                <StatusBadge tone="success">Resolved</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Dismissed</StatusBadge>
              ),
          },
        ]),
    {
      id: "date",
      label: "Date",
      priority: 1,
      minWidth: 120,
      cell: ({ latest }) => <span className="whitespace-nowrap tabular-nums">{formatDate(latest.createdAt)}</span>,
    },
  ]

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: query, onChange: changeQuery }}
            filters={
              <SegmentedControl
                label={open ? "Filter by issue" : "Filter by status"}
                items={segments[status]}
                value={segment}
                onValueChange={(next) => {
                  setSegment(next)
                  setPage(1)
                }}
              />
            }
            count={
              <Count
                value={reportCount}
                total={filteredView ? totalReports : undefined}
                noun={open ? "open report" : "closed report"}
              />
            }
          />
        }
      />
      <PageContent>
        <div ref={focus.surfaceRef} tabIndex={-1} className="rounded-(--pn-r-4)">
          <DataTable
            label={open ? "Open reports" : "Closed reports"}
            columns={columns}
            rows={rows}
            getRowId={(group) => group.key}
            onRowClick={openReport}
            rowLabel={(group) => reference(group.latest) ?? "report"}
            rowHref={(group) => {
              const target = reportTarget(group.latest)
              return target && router.buildLocation(target).href
            }}
            actions={
              open && canWrite
                ? (group) => (
                    <>
                      <IconButton
                        label="Dismiss"
                        ariaLabel={`Dismiss report for ${reference(group.latest) ?? "this group"}`}
                        icon={X}
                        onClick={(event) => void settle(group, "dismiss", event.currentTarget)}
                      />
                      <IconButton
                        label="Resolve"
                        ariaLabel={`Resolve report for ${reference(group.latest) ?? "this group"}`}
                        icon={Check}
                        onClick={(event) => void settle(group, "resolve", event.currentTarget)}
                      />
                    </>
                  )
                : undefined
            }
            actionsWidth={116}
            pagination={{
              page: currentPage,
              pageSize,
              total: groups.length,
              onPage: setPage,
              onPageSize: (size) => {
                setPageSize(size)
                setPage(1)
              },
            }}
            rowProps={(group) =>
              leaving.has(group.key)
                ? { className: "pointer-events-none opacity-0 transition-opacity duration-120 ease-(--pn-ease-in)" }
                : {}
            }
            empty={
              filteredView ? (
                <EmptyState
                  icon={open ? Inbox : CircleCheck}
                  title="No reports match"
                  text="Clear the search or choose another filter."
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : open ? (
                <EmptyState
                  icon={Inbox}
                  title="No open reports"
                  text="Broken Telegram or WhatsApp links and missing groups reported by students appear here."
                />
              ) : (
                <EmptyState
                  icon={CircleCheck}
                  title="No closed reports"
                  text="Resolved and dismissed reports appear here."
                />
              )
            }
          />
        </div>
      </PageContent>
    </>
  )
}
