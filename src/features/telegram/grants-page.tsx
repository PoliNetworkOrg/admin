import { Link } from "@tanstack/react-router"
import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, CalendarClock, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { CreateGrantDialog } from "@/components/telegram/create-grant-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ApiOutput } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"

type GrantRecord = ApiOutput["tg"]["grants"]["getOngoing"]["grants"][number]
type GrantRow = GrantRecord & { status: "active" | "scheduled" }

type TelegramGrants = {
  ongoing: ApiOutput["tg"]["grants"]["getOngoing"]
  scheduled: ApiOutput["tg"]["grants"]["getScheduled"]
}

const grantColumnHelper = createAppColumnHelper<GrantRow>()

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

export function TelegramGrantsPage({ grants: { ongoing, scheduled } }: { grants: TelegramGrants }) {
  const [tab, setTab] = useState<"all" | "ongoing" | "scheduled">("all")
  const ongoingGrants = ongoing.grants.map((record): GrantRow => ({ ...record, status: "active" }))
  const scheduledGrants = scheduled.grants.map((record): GrantRow => ({ ...record, status: "scheduled" }))
  const grants = useMemo(
    () =>
      tab === "ongoing"
        ? ongoingGrants
        : tab === "scheduled"
          ? scheduledGrants
          : [...ongoingGrants, ...scheduledGrants],
    [ongoingGrants, scheduledGrants, tab]
  )
  const columns = useMemo(() => {
    const sortableHeader = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, GrantRow>, "getIsSorted" | "getToggleSortingHandler">
    ) => {
      const sorted = column.getIsSorted()
      const Icon = !sorted ? ChevronsUpDown : sorted === "asc" ? ArrowUp : ArrowDown
      return (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={column.getToggleSortingHandler()}
          aria-label={`${label}, ${sorted ? `sorted ${sorted === "asc" ? "ascending" : "descending"}` : "not sorted"}`}
        >
          {label}
          <Icon data-icon="inline-end" />
        </Button>
      )
    }

    return grantColumnHelper.columns([
      grantColumnHelper.display({
        id: "user",
        header: "User",
        cell: ({ row }) => {
          const { user, grant } = row.original
          const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : `User ${grant.userId}`
          return (
            <Link
              to="/dashboard/telegram/users/$userId"
              params={{ userId: String(grant.userId) }}
              className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
            >
              <span className="block font-medium">{name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {user?.username ? `@${user.username}` : `Telegram ID ${grant.userId}`}
              </span>
            </Link>
          )
        },
      }),
      grantColumnHelper.display({
        id: "reason",
        header: "Reason",
        cell: ({ row }) =>
          row.original.grant.reason || <span className="italic text-muted-foreground">Not provided</span>,
      }),
      grantColumnHelper.display({
        id: "grantor",
        header: "Authorized by",
        cell: ({ row }) => (
          <Link
            to="/dashboard/telegram/users/$userId"
            params={{ userId: String(row.original.grant.grantedBy) }}
            className="font-mono text-xs text-primary hover:underline"
          >
            {row.original.grant.grantedBy}
          </Link>
        ),
      }),
      grantColumnHelper.accessor((row) => new Date(row.grant.validSince).getTime(), {
        id: "validSince",
        header: ({ column }) => sortableHeader("Starts", column),
        cell: ({ row }) => <time className="text-xs">{formatDate(row.original.grant.validSince)}</time>,
      }),
      grantColumnHelper.accessor((row) => new Date(row.grant.validUntil).getTime(), {
        id: "validUntil",
        header: ({ column }) => sortableHeader("Expires", column),
        cell: ({ row }) => <time className="text-xs">{formatDate(row.original.grant.validUntil)}</time>,
      }),
      grantColumnHelper.accessor("status", {
        header: ({ column }) => sortableHeader("Status", column),
        cell: ({ getValue }) => (
          <Badge variant={getValue() === "scheduled" ? "secondary" : "default"}>
            {getValue() === "scheduled" ? "Scheduled" : "Active"}
          </Badge>
        ),
      }),
    ])
  }, [])
  const table = useAppTable({
    key: "telegram-grants",
    columns,
    data: grants,
    initialState: { sorting: [{ id: "validSince", desc: false }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const { grant, user, status } = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      const searchable = [
        grant.userId,
        grant.grantedBy,
        grant.reason,
        user?.firstName,
        user?.lastName,
        user?.username,
        formatDate(grant.validSince),
        formatDate(grant.validUntil),
        status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
      return !query || searchable.includes(query)
    },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(String(table.state.globalFilter ?? "").trim())

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Grants"
        description="Review board-authorized periods when approved people may send promotional messages and links without automatic moderation."
        count={filteredCount}
        total={grants.length}
        searchPlaceholder="Search users, authorizers, or reasons…"
        action={<CreateGrantDialog />}
        onSearch={(value) => {
          table.setGlobalFilter(value)
          table.setPageIndex(0)
        }}
      />
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={1}
        value={[tab]}
        onValueChange={(value) => {
          const next = value[0]
          if (next === "all" || next === "ongoing" || next === "scheduled") {
            setTab(next)
            table.setPageIndex(0)
          }
        }}
        className="mb-4"
        aria-label="Grant status"
      >
        <ToggleGroupItem value="all">
          All <b className="ml-1 text-xs">{ongoingGrants.length + scheduledGrants.length}</b>
        </ToggleGroupItem>
        <ToggleGroupItem value="ongoing">
          Ongoing <b className="ml-1 text-xs">{ongoingGrants.length}</b>
        </ToggleGroupItem>
        <ToggleGroupItem value="scheduled">
          Scheduled <b className="ml-1 text-xs">{scheduledGrants.length}</b>
        </ToggleGroupItem>
      </ToggleGroup>
      {filteredCount ? (
        <>
          <TableSurface>
            <Table className="min-w-[900px] text-left">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <DataTableHead
                        key={header.id}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </DataTableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3.5 text-sm">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableSurface>
          <Pagination
            page={table.state.pagination.pageIndex + 1}
            pageCount={table.getPageCount()}
            pageSize={table.state.pagination.pageSize}
            total={filteredCount}
            onPageChange={(page) => table.setPageIndex(page - 1)}
            onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          />
        </>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title={hasSearch ? "No grants match this search" : "No grants in this view"}
          text={
            hasSearch
              ? "Clear the search or try a different user, authorizer, or reason."
              : "There are no grants for the selected status."
          }
        />
      )}
    </div>
  )
}
