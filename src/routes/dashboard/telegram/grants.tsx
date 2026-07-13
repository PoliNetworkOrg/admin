import { createFileRoute } from "@tanstack/react-router"
import { CalendarClock } from "lucide-react"
import { useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { createAppColumnHelper, useAppTable } from "@/lib/table"
import { getOngoingGrants, getScheduledGrants } from "@/server/api.functions"

type Grant = {
  userId: number
  grantorId?: number
  role?: string
  createdAt?: string
  expiresAt?: string | null
  scheduledAt?: string | null
}
const grantColumnHelper = createAppColumnHelper<Grant>()
export const Route = createFileRoute("/dashboard/telegram/grants")({
  loader: async () => ({ ongoing: await getOngoingGrants(), scheduled: await getScheduledGrants() }),
  pendingComponent: () => <DataPageSkeleton columns={5} withTabs />,
  component: Grants,
})

function Grants() {
  const { ongoing, scheduled } = Route.useLoaderData()
  const [tab, setTab] = useState<"all" | "ongoing" | "scheduled">("all")
  const ongoingGrants = (ongoing.data as { grants?: Grant[] }).grants ?? []
  const scheduledGrants = (scheduled.data as { grants?: Grant[] }).grants ?? []
  const grants =
    tab === "ongoing" ? ongoingGrants : tab === "scheduled" ? scheduledGrants : [...ongoingGrants, ...scheduledGrants]
  const connected = ongoing.connected && scheduled.connected
  const columns = grantColumnHelper.columns([
    grantColumnHelper.accessor("userId", { header: "User", cell: ({ getValue }) => getValue() }),
    grantColumnHelper.accessor("role", {
      header: "Role",
      cell: ({ getValue }) => (
        <Badge className="h-5 bg-accent px-1.5 font-mono text-[9px] text-primary">{getValue() ?? "Access grant"}</Badge>
      ),
    }),
    grantColumnHelper.accessor("grantorId", { header: "Granted by", cell: ({ getValue }) => getValue() ?? "—" }),
    grantColumnHelper.display({
      id: "schedule",
      header: "Schedule",
      cell: ({ row }) => row.original.scheduledAt ?? row.original.createdAt ?? "—",
    }),
    grantColumnHelper.display({
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.scheduledAt ? "secondary" : "default"} className="h-5 px-1.5 font-mono text-[9px]">
          {row.original.scheduledAt ? "Scheduled" : "Active"}
        </Badge>
      ),
    }),
  ])
  const table = useAppTable({
    key: "telegram-grants",
    columns,
    data: grants,
    initialState: { sorting: [{ id: "userId", desc: false }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const grant = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      return (
        !query ||
        `${grant.userId} ${grant.grantorId ?? ""} ${grant.role ?? ""} ${grant.scheduledAt ?? ""} ${grant.createdAt ?? ""}`
          .toLocaleLowerCase()
          .includes(query)
      )
    },
  })
  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Access grants"
        description="See who has temporary access, when it begins, and when it expires."
        count={table.getFilteredRowModel().rows.length}
        onSearch={(value) => table.setGlobalFilter(value)}
      />
      <LiveStatus connected={connected} message={ongoing.message ?? scheduled.message} />
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={1}
        value={[tab]}
        onValueChange={(value) => {
          const next = value[0]
          if (next === "all" || next === "ongoing" || next === "scheduled") setTab(next)
        }}
        className="mb-4"
        aria-label="Grant status"
      >
        <ToggleGroupItem
          value="all"
          className="text-[10px] text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
        >
          All <b className="ml-1 font-mono text-[10px]">{ongoingGrants.length + scheduledGrants.length}</b>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="ongoing"
          className="text-[10px] text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
        >
          Ongoing <b className="ml-1 font-mono text-[10px]">{ongoingGrants.length}</b>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="scheduled"
          className="text-[10px] text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
        >
          Scheduled <b className="ml-1 font-mono text-[10px]">{scheduledGrants.length}</b>
        </ToggleGroupItem>
      </ToggleGroup>
      {table.getFilteredRowModel().rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="min-w-[700px] text-left">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-0">
                  {headerGroup.headers.map((header) => (
                    <DataTableHead key={header.id}>
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
                    <TableCell key={cell.id} className="px-4 py-3 text-sm">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="No grants in this view"
          text="Create a grant to give a member scoped, auditable access."
        />
      )}
      {table.getFilteredRowModel().rows.length > 0 && (
        <Pagination
          page={table.state.pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          pageSize={table.state.pagination.pageSize}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
        />
      )}
    </div>
  )
}
