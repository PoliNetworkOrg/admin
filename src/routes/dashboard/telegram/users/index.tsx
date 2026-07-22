import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ArrowRight, MessageCircle } from "lucide-react"
import { useMemo } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import type { TgUser } from "@/lib/api/types"
import { createAppColumnHelper, useAppTable } from "@/lib/table"
import { getTelegramUsers } from "@/server/api.functions"

const userColumnHelper = createAppColumnHelper<TgUser>()

export const Route = createFileRoute("/dashboard/telegram/users/")({
  loader: () => getTelegramUsers(),
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: TelegramUsers,
})

function TelegramUsers() {
  const response = Route.useLoaderData()
  const users = response.data?.users ?? []
  const navigate = useNavigate()

  const columns = useMemo(
    () =>
      userColumnHelper.columns([
        userColumnHelper.display({
          id: "name",
          header: "Name",
          cell: ({ row }) => {
            const { firstName, lastName } = row.original
            const name = [firstName, lastName].filter(Boolean).join(" ")
            return (
              <div className="flex items-center gap-2">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-accent font-mono text-sm font-medium text-accent-foreground">
                    {[firstName[0], lastName?.[0] ?? ""].join("").trim().toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="block font-medium">{name}</span>
              </div>
            )
          },
        }),
        userColumnHelper.accessor("id", {
          header: "Telegram ID",
          cell: ({ getValue }) => <span className="font-mono text-sm font-medium">{getValue()}</span>,
        }),
        userColumnHelper.accessor("username", {
          header: "Username",
          cell: ({ getValue }) => {
            const username = getValue()
            return username ? (
              <span className="font-mono text-sm font-medium text-primary">@{username}</span>
            ) : (
              <span className="text-sm italic text-muted-foreground">Not set</span>
            )
          },
        }),
        userColumnHelper.display({
          id: "actions",
          header: "",
          cell: () => (
            <span className="ml-auto flex size-9 items-center justify-center text-muted-foreground transition-colors group-hover/row:text-primary">
              <ArrowRight className="size-4" />
            </span>
          ),
        }),
      ]),
    []
  )
  const table = useAppTable({
    key: "telegram-users",
    columns,
    data: users,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
    globalFilterFn: (row, _columnId, value) => {
      const user = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
        .replace(/^@/, "")
      const searchable = [user.username, user.firstName, user.lastName].filter(Boolean).join(" ").toLocaleLowerCase()
      return !query || searchable.includes(query)
    },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(String(table.state.globalFilter ?? "").trim())

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Telegram users"
        description="Find people across the PoliNetwork Telegram ecosystem and inspect their membership footprint."
        count={filteredCount}
        total={users.length}
        searchPlaceholder="Search by name or username…"
        onSearch={(value) => {
          table.setGlobalFilter(value)
          table.setPageIndex(0)
        }}
      />
      <LiveStatus connected={response.connected} message={response.message} />
      {response.connected &&
        (filteredCount ? (
          <>
            <TableSurface>
              <Table className="min-w-[700px] text-left">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <DataTableHead key={header.id} className="last:w-16">
                          {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                        </DataTableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => {
                    const user = row.original
                    const openUser = () =>
                      navigate({
                        to: "/dashboard/telegram/users/$userId",
                        params: { userId: String(user.id) },
                      })

                    return (
                      <TableRow
                        key={row.id}
                        className="group/row cursor-pointer outline-none focus-visible:bg-muted/70 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/25"
                        tabIndex={0}
                        aria-label={`Open details for ${[user.firstName, user.lastName].filter(Boolean).join(" ")}`}
                        onClick={() => void openUser()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            void openUser()
                          }
                        }}
                      >
                        {row.getAllCells().map((cell) => (
                          <TableCell key={cell.id} className="px-4 py-3.5 text-sm">
                            <table.FlexRender cell={cell} />
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableSurface>
            <Pagination
              page={table.state.pagination.pageIndex + 1}
              pageCount={table.getPageCount()}
              pageSize={table.state.pagination.pageSize}
              onPageChange={(page) => table.setPageIndex(page - 1)}
              onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
            />
          </>
        ) : (
          <EmptyState
            icon={MessageCircle}
            title={hasSearch ? "No users match this search" : "No Telegram users yet"}
            text={
              hasSearch ? "Clear the search or try a different name or username." : "No Telegram users were returned."
            }
          />
        ))}
    </div>
  )
}
