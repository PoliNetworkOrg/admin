import { Link, useNavigate } from "@tanstack/react-router"
import { CalendarPlus, ShieldCheck } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  SegmentedControl,
  StatusBadge,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { CreateGrantDialog } from "@/components/telegram/create-grant-dialog"
import { telegramUserName } from "@/components/telegram/telegram-user"
import { Button } from "@/components/ui/button"
import type { getTelegramGrantsWithGrantors } from "@/features/telegram/grants.functions"
import type { TgUser } from "@/lib/api/types"
import { formatDate, formatDateTime } from "@/lib/format"

export type TelegramGrants = Awaited<ReturnType<typeof getTelegramGrantsWithGrantors>>

type GrantRecord = TelegramGrants["ongoing"]["grants"][number]
type Status = "active" | "scheduled"
type Tab = "all" | "ongoing" | "scheduled"

type Row = GrantRecord & { grantor: TgUser | null; status: Status }

const TAB_STATUS = { ongoing: "active", scheduled: "scheduled" } satisfies Record<Exclude<Tab, "all">, Status>

function userName(user: GrantRecord["user"], id: number) {
  return user ? telegramUserName(user) : `User ${id}`
}

function searchText({ grant, user, grantor, status }: Row) {
  return [
    grant.userId,
    user?.firstName,
    user?.lastName,
    user?.username,
    grant.grantedBy,
    grantor?.firstName,
    grantor?.lastName,
    grantor?.username,
    grant.reason,
    formatDate(grant.validSince),
    formatDate(grant.validUntil),
    status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
}

const sortValue = {
  starts: (row: Row) => row.grant.validSince.getTime(),
  expires: (row: Row) => row.grant.validUntil.getTime(),
  status: (row: Row) => (row.status === "active" ? 0 : 1),
} satisfies Record<string, (row: Row) => number>

function isSortColumn(column: string): column is keyof typeof sortValue {
  return column in sortValue
}

const columns: DataTableColumn<Row>[] = [
  {
    id: "user",
    label: "User",
    minWidth: 180,
    cell: ({ grant, user }) => {
      const name = userName(user, grant.userId)
      return (
        <span className="flex min-w-0 flex-col">
          <span className="truncate" title={name}>
            {name}
          </span>
          <span className="truncate text-xs leading-4 font-normal text-(--pn-fg-muted)">
            {user?.username ? (
              `@${user.username}`
            ) : (
              <>
                Telegram ID <span className="font-mono tabular-nums">{grant.userId}</span>
              </>
            )}
          </span>
        </span>
      )
    },
  },
  {
    id: "reason",
    label: "Reason",
    priority: 4,
    minWidth: 150,
    // Free text: takes the slack and truncates, so the date columns never get pushed out of view.
    fill: true,
    cell: ({ grant }) =>
      grant.reason ? (
        <span className="block truncate" title={grant.reason}>
          {grant.reason}
        </span>
      ) : (
        <Unset />
      ),
  },
  {
    id: "grantor",
    label: "Authorized by",
    priority: 3,
    minWidth: 130,
    // Its own link to the grantor; the row click still opens the grantee.
    cell: ({ grant, grantor }) => (
      <Link
        to="/dashboard/telegram/users/$userId"
        params={{ userId: String(grant.grantedBy) }}
        title={grantor?.username ? `@${grantor.username}` : undefined}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className={
          grantor
            ? "block truncate text-(--pn-fg) underline-offset-2 transition-[color] duration-120 hover:text-(--pn-accent) hover:underline"
            : "font-mono text-(--pn-fg) tabular-nums underline-offset-2 transition-[color] duration-120 hover:text-(--pn-accent) hover:underline"
        }
      >
        {grantor ? telegramUserName(grantor) : grant.grantedBy}
      </Link>
    ),
  },
  {
    id: "starts",
    label: "Starts",
    sortable: true,
    priority: 2,
    minWidth: 150,
    className: "whitespace-nowrap tabular-nums",
    cell: ({ grant }) => formatDateTime(grant.validSince),
  },
  {
    id: "expires",
    label: "Expires",
    sortable: true,
    priority: 1,
    minWidth: 150,
    className: "whitespace-nowrap tabular-nums",
    cell: ({ grant }) => formatDateTime(grant.validUntil),
  },
  {
    id: "status",
    label: "Status",
    // Hides before the text columns: the segmented filter already states the status.
    sortable: true,
    priority: 5,
    minWidth: 110,
    cell: ({ status }) =>
      status === "active" ? (
        <StatusBadge tone="success">Active</StatusBadge>
      ) : (
        <StatusBadge tone="brand">Scheduled</StatusBadge>
      ),
  },
]

const PAGE_SIZE = 20

/** Grants (docs/design.md §7.5): ongoing and scheduled grants with a status filter; a row opens the grantee. */
export function TelegramGrantsPage({ grants: { ongoing, scheduled, grantors } }: { grants: TelegramGrants }) {
  const navigate = useNavigate()
  const canWrite = useCanWrite()
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("all")
  const [sort, setSort] = useState<TableSort>({ column: "starts", direction: "asc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [creating, setCreating] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const current = useMemo(() => {
    const grantorById = new Map(grantors.map((user) => [user.id, user]))
    const toRow = (status: Status) => (record: GrantRecord) => ({
      ...record,
      grantor: grantorById.get(record.grant.grantedBy) ?? null,
      status,
    })
    return [...ongoing.grants.map(toRow("active")), ...scheduled.grants.map(toRow("scheduled"))]
  }, [ongoing, scheduled, grantors])

  const counts = {
    all: current.length,
    ongoing: ongoing.grants.length,
    scheduled: scheduled.grants.length,
  }

  const normalized = deferredQuery.trim().toLocaleLowerCase()
  const filtered = useMemo(() => {
    const inTab = tab === "all" ? current : current.filter((row) => row.status === TAB_STATUS[tab])
    const matching = normalized ? inTab.filter((row) => searchText(row).includes(normalized)) : inTab
    if (!isSortColumn(sort.column)) return matching
    const value = sortValue[sort.column]
    const direction = sort.direction === "asc" ? 1 : -1
    return matching.toSorted(
      (a, b) => (value(a) - value(b)) * direction || a.grant.validSince.getTime() - b.grant.validSince.getTime()
    )
  }, [current, tab, normalized, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const searching = normalized !== ""

  function updateQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: query, onChange: updateQuery, placeholder: "Search users, authorizers or reasons…" }}
            filters={
              <SegmentedControl
                label="Grant status"
                items={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "ongoing", label: "Ongoing", count: counts.ongoing },
                  { value: "scheduled", label: "Scheduled", count: counts.scheduled },
                ]}
                value={tab}
                onValueChange={(next) => {
                  setTab(next)
                  setPage(1)
                }}
              />
            }
            // Segment counts already show each option's total; the count appears only when search narrow
            // the list further, and then just the matching number.
            count={searching ? <Count value={filtered.length} noun="grant" /> : undefined}
          />
        }
        right={
          canWrite ? (
            <Button size="sm" className={buttonMotion} onClick={() => setCreating(true)}>
              <CalendarPlus aria-hidden data-icon="inline-start" />
              New grant
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <DataTable
          label="Grants"
          columns={columns}
          rows={rows}
          getRowId={(row) => row.grant.id}
          sort={sort}
          onSort={(next) => {
            setSort(next)
            setPage(1)
          }}
          onRowClick={(row) =>
            void navigate({ to: "/dashboard/telegram/users/$userId", params: { userId: String(row.grant.userId) } })
          }
          rowLabel={(row) => userName(row.user, row.grant.userId)}
          rowHref={(row) => `/dashboard/telegram/users/${row.grant.userId}`}
          pagination={{
            page: currentPage,
            pageSize,
            total: filtered.length,
            onPage: setPage,
            onPageSize: (size) => {
              setPageSize(size)
              setPage(1)
            },
          }}
          empty={
            searching ? (
              <EmptyState
                icon={ShieldCheck}
                title="No grants match"
                text="Try another user, authorizer or reason."
                action={
                  <Button variant="ghost" size="sm" className={buttonMotion} onClick={() => updateQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No grants in this view"
                text="Grants are board-authorized periods when a user may send links without automatic moderation."
                action={
                  canWrite ? (
                    <Button variant="outline" size="sm" className={buttonMotion} onClick={() => setCreating(true)}>
                      <CalendarPlus aria-hidden data-icon="inline-start" />
                      New grant
                    </Button>
                  ) : undefined
                }
              />
            )
          }
        />
      </PageContent>
      {canWrite && <CreateGrantDialog open={creating} onOpenChange={setCreating} />}
    </>
  )
}
