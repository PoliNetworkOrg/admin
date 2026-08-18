import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
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
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { setGroupVisibility } from "@/features/telegram/groups.functions"
import { LeaveGroupDialog } from "@/features/telegram/leave-group-dialog"
import type { TgGroup } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"

const groupColumnHelper = createAppColumnHelper<TgGroup>()

export function TelegramGroupsPage({ loadedGroups }: { loadedGroups: TgGroup[] }) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setGroupVisibility)
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<number, boolean>>({})
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [refreshError, setRefreshError] = useState("")

  const groups = loadedGroups.map((group) => ({
    ...group,
    hide: visibilityOverrides[group.telegramId] ?? group.hide,
  }))

  async function toggleVisibility(group: TgGroup) {
    if (updatingId !== null) return
    const hide = !group.hide
    setUpdatingId(group.telegramId)
    setMutationError("")
    setVisibilityOverrides((current) => ({ ...current, [group.telegramId]: hide }))

    try {
      await setGroupVisibilityFn({ data: { telegramId: group.telegramId, hide } })
      toast.success(`${group.title} is now ${hide ? "hidden" : "visible"}.`)
      try {
        await router.invalidate({ sync: true })
        setRefreshError("")
        setVisibilityOverrides((current) => {
          const { [group.telegramId]: _removed, ...remaining } = current
          return remaining
        })
      } catch (error) {
        console.error(error)
        setRefreshError("The visibility was updated, but the latest group data could not be refreshed.")
      }
    } catch (error) {
      console.error(error)
      setVisibilityOverrides((current) => {
        const { [group.telegramId]: _removed, ...remaining } = current
        return remaining
      })
      setMutationError("The visibility setting could not be updated. Check your permissions and try again.")
    } finally {
      setUpdatingId(null)
    }
  }

  const columns = useMemo(() => {
    const sortableHeader = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, TgGroup>, "getIsSorted" | "getToggleSortingHandler">
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
        header: ({ column }) => sortableHeader("Group", column),
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
        header: ({ column }) => sortableHeader("Telegram ID", column),
        cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
      }),
      groupColumnHelper.accessor("tag", {
        header: ({ column }) => sortableHeader("Tag", column),
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
          const link = row.original.link
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
      groupColumnHelper.display({
        id: "leave",
        header: "",
        cell: ({ row }) => <LeaveGroupDialog chatId={row.original.telegramId} title={row.original.title} />,
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
      {filteredCount ? (
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
      )}
    </div>
  )
}
