import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Eye, EyeOff, MessageCircleMore } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createAppColumnHelper, useAppTable } from "@/lib/table"
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
  const loadedGroups = response.data as TelegramGroup[]
  const [groups, setGroups] = useState(loadedGroups)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")

  useEffect(() => setGroups(loadedGroups), [loadedGroups])

  async function toggleVisibility(group: TelegramGroup) {
    if (updatingId !== null) return
    const hide = !group.hide
    setUpdatingId(group.telegramId)
    setMutationError("")
    setGroups((current) => current.map((item) => (item.telegramId === group.telegramId ? { ...item, hide } : item)))

    try {
      await setGroupVisibility({ data: { telegramId: group.telegramId, hide } })
      await router.invalidate({ sync: true })
    } catch {
      setGroups((current) => current.map((item) => (item.telegramId === group.telegramId ? group : item)))
      setMutationError("The visibility setting could not be updated. Check your permissions and try again.")
    } finally {
      setUpdatingId(null)
    }
  }

  const columns = useMemo(
    () =>
      groupColumnHelper.columns([
        groupColumnHelper.accessor("title", {
          header: "Group",
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#e9e8df] text-primary">
                <MessageCircleMore className="size-4" />
              </span>
              <b>{row.original.title}</b>
            </div>
          ),
        }),
        groupColumnHelper.accessor("telegramId", { header: "Telegram ID", cell: ({ getValue }) => getValue() }),
        groupColumnHelper.accessor("tag", {
          header: "Tag",
          cell: ({ getValue }) =>
            getValue() ? (
              <Badge className="h-5 rounded-none bg-accent px-1.5 font-mono text-[9px] text-primary">
                @{getValue()}
              </Badge>
            ) : (
              <span className="text-[11px] italic text-muted-foreground">—</span>
            ),
        }),
        groupColumnHelper.display({
          id: "visibility",
          header: "Visibility",
          cell: ({ row }) => {
            const group = row.original
            const pending = updatingId === group.telegramId
            return (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-6 rounded-none border-transparent px-1.5 font-mono text-[9px]",
                  group.hide ? "bg-muted text-muted-foreground" : "bg-[#e5effc] text-primary"
                )}
                disabled={pending}
                onClick={() => void toggleVisibility(group)}
                title="Toggle group visibility"
              >
                {group.hide ? (
                  <>
                    <EyeOff data-icon="inline-start" /> Hidden
                  </>
                ) : (
                  <>
                    <Eye data-icon="inline-start" /> Visible
                  </>
                )}
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
                className="font-mono text-[11px] font-medium text-primary hover:underline"
                href={link}
                target="_blank"
                rel="noreferrer"
              >
                Open link
              </a>
            ) : (
              <span className="text-[11px] italic text-muted-foreground">Not shared</span>
            )
          },
        }),
      ]),
    [updatingId]
  )
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
      return !query || `${group.title}\u0000${group.tag ?? ""}`.toLocaleLowerCase().includes(query)
    },
  })

  return (
    <div className="animate-appear">
      <DataToolbar
        title="Telegram groups"
        description="Maintain the community groups connected to PoliNetwork."
        count={table.getFilteredRowModel().rows.length}
        onSearch={(value) => table.setGlobalFilter(value)}
      />
      <LiveStatus connected={response.connected} message={response.message} />
      {mutationError && (
        <Alert className="mb-4 rounded-none border-l-[3px] border-l-[#d86b3f] bg-[#fff4e8] px-3 py-2.5 text-[11px] text-[#895322]">
          <AlertDescription className="text-[11px] leading-[1.45] text-[#895322]">{mutationError}</AlertDescription>
        </Alert>
      )}
      {table.getFilteredRowModel().rows.length ? (
        <>
          <div className="overflow-auto border border-border bg-card">
            <Table className="min-w-[700px] text-left">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-0">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground"
                      >
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-[#f6f9fe]">
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="px-[15px] py-3 text-xs">
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
          icon={MessageCircleMore}
          title="No matching groups"
          text="Try another filter or check the backend connection."
        />
      )}
    </div>
  )
}
