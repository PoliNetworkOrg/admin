import { useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { History, ScrollText } from "lucide-react"
import { useEffect, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  floatingMotion,
  LoadingButton,
  raisedSurface,
  SegmentedControl,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { appToast, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { actionLabel, actorName, AREA_LABEL, areaLabel, OUTCOME, targetName } from "@/features/audit-log/audit-labels"
import { AUDIT_AREAS, getAuditEvent, getAuditEvents } from "@/features/audit-log/audit-log.functions"
import { AuditEventDialog } from "@/features/audit-log/event-dialog"
import type { AuditArea, AuditEvent, AuditEventPage, AuditOutcome } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type AuditFilters = { q: string; area: AuditArea | undefined; outcome: AuditOutcome | undefined }

const ALL_AREAS = "all"
const SEARCH_DELAY_MS = 300

const columns: DataTableColumn<AuditEvent>[] = [
  {
    id: "action",
    label: "Action",
    minWidth: 200,
    mobile: "inline",
    cell: (event) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{actionLabel(event.action)}</span>
        <span className="truncate text-xs leading-4 font-normal text-(--pn-fg-muted)">{areaLabel(event.action)}</span>
      </span>
    ),
  },
  {
    id: "outcome",
    label: "Outcome",
    priority: 2,
    minWidth: 110,
    mobile: "end",
    cell: (event) => <StatusBadge tone={OUTCOME[event.outcome].tone}>{OUTCOME[event.outcome].label}</StatusBadge>,
  },
  {
    id: "target",
    label: "Target",
    priority: 1,
    minWidth: 160,
    fill: true,
    mobile: "text",
    cell: (event) => {
      const name = targetName(event)
      return name ? (
        <Hint overflowOnly label={name}>
          <span className="block truncate max-shell:whitespace-normal">{name}</span>
        </Hint>
      ) : (
        <Unset />
      )
    },
  },
  {
    id: "by",
    label: "By",
    priority: 3,
    minWidth: 150,
    mobile: "meta",
    cell: (event) => (
      <Hint overflowOnly label={actorName(event)}>
        <span className="block truncate">{actorName(event)}</span>
      </Hint>
    ),
  },
  {
    id: "reason",
    label: "Reason",
    priority: 5,
    minWidth: 140,
    mobile: "hidden",
    cell: (event) =>
      event.reason ? (
        <Hint overflowOnly label={event.reason}>
          <span className="block truncate">{event.reason}</span>
        </Hint>
      ) : (
        <Unset />
      ),
  },
  {
    id: "when",
    label: "When",
    priority: 4,
    minWidth: 150,
    mobile: "meta",
    className: "whitespace-nowrap tabular-nums",
    cell: (event) => formatDateTime(event.createdAt),
  },
]

type AuditLogPageProps = {
  page: AuditEventPage
  filters: AuditFilters
  /** The event open in the dialog, from `?event=`. */
  eventId: number | undefined
}

/** Every change made through the backend, newest first; filters reload from the backend, older pages append. */
export function AuditLogPage({ page, filters, eventId }: AuditLogPageProps) {
  const navigate = useNavigate({ from: "/dashboard/audit-log/" })
  const router = useRouter()
  const fetchEvents = useServerFn(getAuditEvents)
  const fetchEvent = useServerFn(getAuditEvent)
  const [query, setQuery] = useState(filters.q)
  const [older, setOlder] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState(page.nextCursor)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [linked, setLinked] = useState<AuditEvent | "loading" | null>(null)

  const events = [...page.events, ...older]
  const filtered = filters.q !== "" || filters.area !== undefined || filters.outcome !== undefined

  // The search goes to the backend, so it waits for typing to pause.
  useEffect(() => {
    const q = query.trim()
    if (q === filters.q) return
    const timer = setTimeout(
      () => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true }),
      SEARCH_DELAY_MS
    )
    return () => clearTimeout(timer)
  }, [query, filters.q, navigate])

  // An event opened from a link may be older than the pages loaded so far.
  const listed = eventId === undefined ? undefined : events.find((event) => event.id === eventId)
  useEffect(() => {
    if (eventId === undefined || listed) return
    let current = true
    setLinked("loading")
    fetchEvent({ data: { id: eventId } })
      .then((event) => current && setLinked(event))
      .catch((error: Error) => {
        console.error(error)
        if (current) setLinked(null)
        appToast.error("Couldn't load the event.")
      })
    return () => {
      current = false
    }
  }, [eventId, listed, fetchEvent])
  const selected = eventId === undefined ? null : (listed ?? linked)

  function setFilters(next: Partial<Omit<AuditFilters, "q">>) {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  }

  function clearFilters() {
    setQuery("")
    void navigate({ search: {}, replace: true })
  }

  async function loadOlder() {
    if (cursor === null) return
    setLoadingOlder(true)
    try {
      const next = await fetchEvents({
        data: { cursor, area: filters.area, outcome: filters.outcome, search: filters.q || undefined },
      })
      setOlder((loaded) => [...loaded, ...next.events])
      setCursor(next.nextCursor)
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't load older events.")
    } finally {
      setLoadingOlder(false)
    }
  }

  const eventHref = (event: AuditEvent) =>
    router.buildLocation({ to: "/dashboard/audit-log", search: (prev) => ({ ...prev, event: event.id }) }).href

  return (
    <>
      <PageBar
        description="Who changed what across PoliNetwork, and when"
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery, placeholder: "Search action, target, reason or error…" }}
            filters={
              <>
                <Select
                  items={[
                    { value: ALL_AREAS, label: "All areas" },
                    ...AUDIT_AREAS.map((area) => ({ value: area, label: AREA_LABEL[area] })),
                  ]}
                  value={filters.area ?? ALL_AREAS}
                  onValueChange={(value) => setFilters({ area: AUDIT_AREAS.find((area) => area === value) })}
                >
                  <SelectTrigger
                    aria-label="Area"
                    className="h-10 w-44 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) text-[14px] text-(--pn-fg) max-shell:w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={cn(raisedSurface, floatingMotion)}>
                    <SelectItem value={ALL_AREAS} className="h-9 text-[13px]">
                      All areas
                    </SelectItem>
                    {AUDIT_AREAS.map((area) => (
                      <SelectItem key={area} value={area} className="h-9 text-[13px]">
                        {AREA_LABEL[area]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SegmentedControl
                  label="Outcome"
                  items={[
                    { value: "all", label: "All" },
                    { value: "success", label: OUTCOME.success.label },
                    { value: "failure", label: OUTCOME.failure.label },
                    { value: "denied", label: OUTCOME.denied.label },
                  ]}
                  value={filters.outcome ?? "all"}
                  onValueChange={(value) => setFilters({ outcome: value === "all" ? undefined : value })}
                />
              </>
            }
          />
        }
      />
      <PageContent>
        <div className="flex flex-col gap-4">
          <DataTable
            label="Audit events"
            columns={columns}
            rows={events}
            getRowId={(event) => event.id}
            onRowClick={(event) => void navigate({ search: (prev) => ({ ...prev, event: event.id }) })}
            rowLabel={(event) => `${actionLabel(event.action)} ${targetName(event) ?? ""}`.trim()}
            rowHref={eventHref}
            selectedRowId={eventId}
            empty={
              filtered ? (
                <EmptyState
                  icon={ScrollText}
                  title="No events match"
                  text="Try another search, area or outcome."
                  action={
                    <Button variant="ghost" size="sm" className={buttonMotion} onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ScrollText}
                  title="No events yet"
                  text="Every change made across PoliNetwork appears here, with its author, target, reason and outcome."
                />
              )
            }
          />
          {cursor !== null && (
            <div className="flex justify-center">
              <LoadingButton variant="outline" icon={History} pending={loadingOlder} onClick={() => void loadOlder()}>
                Load older events
              </LoadingButton>
            </div>
          )}
        </div>
      </PageContent>
      <AuditEventDialog
        event={selected}
        onClose={() => void navigate({ search: ({ event: _event, ...rest }) => rest, replace: true })}
      />
    </>
  )
}
