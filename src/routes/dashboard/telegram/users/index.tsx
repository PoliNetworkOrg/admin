import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, MessageCircle } from "lucide-react"
import { useMemo } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, useAppTable } from "@/lib/table"
import { getTelegramUsers } from "@/server/api.functions"

type TelegramUser = {
  id: number
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  profilePicUrl?: string | null
}

const userColumnHelper = createAppColumnHelper<TelegramUser>()

export const Route = createFileRoute("/dashboard/telegram/users/")({
  loader: () => getTelegramUsers(),
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: TelegramUsers,
})

function TelegramUsers() {
  const response = Route.useLoaderData()
  const users = (response.data as { users?: TelegramUser[] }).users ?? []

  const columns = useMemo(
    () =>
      userColumnHelper.columns([
        userColumnHelper.accessor("id", {
          header: "Telegram ID",
          cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue()}</span>,
        }),
        userColumnHelper.display({
          id: "identity",
          header: "Identity",
          cell: ({ row }) => {
            const user = row.original
            const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"
            return (
              <Link
                to="/dashboard/telegram/users/$userId"
                params={{ userId: String(user.id) }}
                className="flex w-max items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
              >
                <Avatar className="size-9">
                  {user.profilePicUrl && <AvatarImage src={user.profilePicUrl} alt="" />}
                  <AvatarFallback className="bg-accent font-mono text-[10px] font-medium text-accent-foreground">
                    {(user.firstName?.[0] ?? user.username?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <span className="block font-medium tracking-[-0.01em]">{name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Open member details</span>
                </span>
              </Link>
            )
          },
        }),
        userColumnHelper.accessor("username", {
          header: "Username",
          cell: ({ getValue }) => {
            const username = getValue()
            return username ? (
              <span className="font-mono text-[11px] font-medium text-primary">@{username}</span>
            ) : (
              <span className="text-xs italic text-muted-foreground">Not set</span>
            )
          },
        }),
        userColumnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <Link
              to="/dashboard/telegram/users/$userId"
              params={{ userId: String(row.original.id) }}
              className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/25"
              aria-label={`Open ${row.original.username ?? row.original.id}`}
            >
              <ArrowRight className="size-4" />
            </Link>
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
