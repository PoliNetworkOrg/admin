import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { Column } from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageCircleMore,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"
import { getTelegramGroups, setGroupVisibility } from "@/server/api.functions"

type TelegramGroup = {
  telegramId: number
  title: string
  tag?: string | null
  link?: string | null
  inviteLink?: string | null
  hide?: boolean | null
}

const groupColumnHelper = createAppColumnHelper<TelegramGroup>()

export const Route = createFileRoute("/dashboard/telegram/groups")({
  loader: () => getTelegramGroups(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: TelegramGroups,
})

function TelegramGroups() {
  const response = Route.useLoaderData()
  const router = useRouter()
  const loadedGroups = (response.data as TelegramGroup[] | null) ?? []
  const [groups, setGroups] = useState(loadedGroups)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [refreshError, setRefreshError] = useState("")

  useEffect(() => setGroups(loadedGroups), [loadedGroups])

  async function toggleVisibility(group: TelegramGroup) {
    if (updatingId !== null) return
    const hide = !group.hide
    setUpdatingId(group.telegramId)
    setMutationError("")
    setGroups((current) => current.map((item) => (item.telegramId === group.telegramId ? { ...item, hide } : item)))
    let updated = false

    try {
      await setGroupVisibility({ data: { telegramId: group.telegramId, hide } })
      updated = true
      toast.success(`${group.title} is now ${hide ? "hidden" : "visible"}.`)
    } catch {
      setGroups((current) => current.map((item) => (item.telegramId === group.telegramId ? group : item)))
      setMutationError("The visibility setting could not be updated. Check your permissions and try again.")
    } finally {
      setUpdatingId(null)
    }

    if (!updated) return

    try {
      await router.invalidate({ sync: true })
      setRefreshError("")
    } catch {
      setRefreshError("The visibility was updated, but the latest group data could not be refreshed.")
    }
  }

  const columns = useMemo(() => {
    const header = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, TelegramGroup>, "getIsSorted" | "getToggleSortingHandler">
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
    return groupColumnHelper.columns([
      groupColumnHelper.accessor("title", {
        header: ({ column }) => header("Group", column),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
              <MessageCircleMore className="size-4" />
            </span>
            <b>{row.original.title}</b>
          </div>
        ),
      }),
      groupColumnHelper.accessor("telegramId", {
        header: ({ column }) => header("Telegram ID", column),
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      }),
      groupColumnHelper.accessor("tag", {
        header: ({ column }) => header("Tag", column),
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge variant="secondary" className="font-mono text-[10px] text-primary">
              @{getValue()}
            </Badge>
          ) : (
            <span className="text-xs italic text-muted-foreground">Not set</span>
          ),
      }),
      groupColumnHelper.display({
        id: "visibility",
        header: "Visibility",
        cell: ({ row }) => {
          const group = row.original
          const pending = updatingId === group.telegramId
          const visible = !group.hide
          return (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1 text-xs",
                visible ? "border-primary/30 bg-accent text-primary" : "text-muted-foreground"
              )}
              disabled={pending}
              aria-busy={pending}
              aria-pressed={visible}
              aria-label={`${group.title} is ${visible ? "visible" : "hidden"}. Change visibility`}
              onClick={() => void toggleVisibility(group)}
            >
              {pending ? <LoaderCircle className="animate-spin-slow" /> : visible ? <Eye /> : <EyeOff />}
              {visible ? "Visible" : "Hidden"}
            </Button>
          )
        },
      }),
      groupColumnHelper.display({
        id: "invite",
        header: "Invite",
        cell: ({ row }) => {
          const link = row.original.link ?? row.original.inviteLink
          return link ? (
            <a
              className="rounded-md font-medium text-primary flex items-center gap-1 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3" />
              Open invite link
            </a>
          ) : (
            <span className="text-xs italic text-muted-foreground">Not shared</span>
          )
        },
      }),
    ])
  }, [updatingId])
  const table = useAppTable({
    key: "telegram-groups",
    columns,
    data: groups,
    initialState: { sorting: [{ id: "title", desc: false }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const group = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
        .replace(/^@/, "")
      return !query || [group.title, group.tag].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)
    },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(String(table.state.globalFilter ?? "").trim())

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Telegram groups"
        description="Maintain the community groups connected to PoliNetwork."
        count={filteredCount}
        total={groups.length}
        searchPlaceholder="Search by group name or tag…"
        onSearch={(value) => {
          table.setGlobalFilter(value)
          table.setPageIndex(0)
        }}
      />
      <LiveStatus
        connected={response.connected}
        message={response.message}
        onRetry={() => router.invalidate({ sync: true })}
      />
      {mutationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      )}
      {refreshError && (
        <Alert className="mb-4">
          <AlertDescription>{refreshError}</AlertDescription>
        </Alert>
      )}
      {(response.connected || groups.length > 0) &&
        (filteredCount ? (
          <>
            <TableSurface>
              <Table className="min-w-[760px] text-left">
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
            icon={MessageCircleMore}
            title={hasSearch ? "No groups match this search" : "No Telegram groups yet"}
            text={
              hasSearch ? "Clear the search or try a different group name or tag." : "No Telegram groups were returned."
            }
          />
        ))}
    </div>
  )
}
