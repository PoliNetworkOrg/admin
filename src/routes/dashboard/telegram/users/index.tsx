import { createFileRoute, Link } from "@tanstack/react-router"
import { Eye, MessageCircle } from "lucide-react"
import { useMemo } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
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
          cell: ({ getValue }) => getValue(),
        }),
        userColumnHelper.display({
          id: "identity",
          header: "Identity",
          cell: ({ row }) => {
            const user = row.original
            return (
              <div className="flex items-center gap-2">
                <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent font-mono text-[10px] font-medium text-primary">
                  {(user.firstName?.[0] ?? user.username?.[0] ?? "?").toUpperCase()}
                </span>
                <span>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"}</span>
              </div>
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
              <span className="text-[11px] italic text-muted-foreground">Not set</span>
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
              className="grid size-8 place-items-center rounded-lg bg-accent text-primary transition-colors hover:bg-muted"
              aria-label={`Open ${row.original.username ?? row.original.id}`}
            >
              <Eye className="size-4" />
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
      return (
        !query ||
        `${user.username ?? ""}\u0000${user.firstName ?? ""}\u0000${user.lastName ?? ""}`
          .toLocaleLowerCase()
          .includes(query)
      )
    },
  })

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Telegram users"
        description="Browse members known to the PoliNetwork Telegram ecosystem."
        count={table.getFilteredRowModel().rows.length}
        onSearch={(value) => table.setGlobalFilter(value)}
      />
      <LiveStatus connected={response.connected} message={response.message} />
      {table.getFilteredRowModel().rows.length ? (
        <>
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
          title="No matching Telegram users"
          text="Try another filter or check the backend connection."
        />
      )}
    </div>
  )
}
