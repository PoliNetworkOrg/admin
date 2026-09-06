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
  type LucideIcon,
  MessageCircleMore,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { GroupLabelBadges } from "@/features/group-labels/group-label-badges"
import { GroupLabelsDialog } from "@/features/group-labels/group-labels-dialog"
import { setGroupVisibility } from "@/features/telegram/groups.functions"
import { LeaveGroupDialog } from "@/features/telegram/leave-group-dialog"
import { useGroupVisibilityToggle } from "@/hooks/use-group-visibility-toggle"
import type { TgGroup, TgGroupLabel } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"

const groupColumnHelper = createAppColumnHelper<TgGroup>()

/** The interactive groups table (visibility toggle, invite link, leave, click-to-edit-labels), given an already-filtered group list. */
export function GroupsTable({
  groups: loadedGroups,
  allLabels,
  labelsByGroupId,
  emptyIcon = MessageCircleMore,
  emptyTitle,
  emptyText,
}: {
  groups: TgGroup[]
  allLabels: TgGroupLabel[]
  labelsByGroupId: Map<number, TgGroupLabel[]>
  emptyIcon?: LucideIcon
  emptyTitle: string
  emptyText: string
}) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setGroupVisibility)
  const { updatingId, mutationError, refreshError, resolveHide, toggleVisibility } = useGroupVisibilityToggle(
    (telegramId: number, hide: boolean) => setGroupVisibilityFn({ data: { telegramId, hide } })
  )
  const [editingGroup, setEditingGroup] = useState<TgGroup | null>(null)

  const groups = loadedGroups.map((group) => ({
    ...group,
    hide: resolveHide(group.telegramId, group.hide),
  }))

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
        id: "labels",
        header: "Labels",
        cell: ({ row }) => <GroupLabelBadges labels={labelsByGroupId.get(row.original.telegramId) ?? []} />,
      }),
      groupColumnHelper.display({
        id: "invite",
        header: "",
        cell: ({ row }) => {
          const link = row.original.link
          return link ? (
            <a
              className="rounded-md font-medium text-primary inline-flex items-center outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
              href={link}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="size-4" />
              <span className="sr-only">Open invite link</span>
            </a>
          ) : (
            <span className="inline-flex text-muted-foreground">
              <X className="size-4" />
              <span className="sr-only">Not shared</span>
            </span>
          )
        },
      }),
      groupColumnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const group = row.original
          const pending = updatingId === group.telegramId
          const visible = !group.hide
          return (
            <div onClick={(event) => event.stopPropagation()} className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(visible ? "border-primary/30 bg-accent text-primary" : "text-muted-foreground")}
                disabled={pending}
                aria-busy={pending}
                aria-pressed={visible}
                aria-label={`${group.title} is ${visible ? "visible" : "hidden"}. Change visibility`}
                onClick={() => void toggleVisibility(group.telegramId, group.title, group.hide)}
              >
                {pending ? <LoaderCircle className="animate-spin-slow" /> : visible ? <Eye /> : <EyeOff />}
              </Button>
              <LeaveGroupDialog chatId={group.telegramId} title={group.title} />
            </div>
          )
        },
      }),
    ])
  }, [updatingId, labelsByGroupId])

  const table = useAppTable({
    key: "telegram-groups",
    columns,
    data: groups,
    initialState: {
      sorting: [{ id: "title", desc: false }],
      pagination: { pageIndex: 0, pageSize: 20 },
    },
  })

  return (
    <>
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
      {groups.length ? (
        <>
          <TableSurface>
            <Table className="min-w-190 text-left">
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
                  <TableRow
                    key={row.id}
                    className="cursor-pointer outline-none focus-visible:bg-muted/70 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/25"
                    tabIndex={0}
                    aria-label={`Edit labels for ${row.original.title}`}
                    onClick={() => setEditingGroup(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setEditingGroup(row.original)
                      }
                    }}
                  >
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
            total={groups.length}
            onPageChange={(page) => table.setPageIndex(page - 1)}
            onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          />
        </>
      ) : (
        <EmptyState icon={emptyIcon} title={emptyTitle} text={emptyText} />
      )}
      <GroupLabelsDialog
        group={editingGroup ? { id: editingGroup.telegramId, title: editingGroup.title, type: "tg" } : null}
        allLabels={allLabels}
        currentLabels={editingGroup ? (labelsByGroupId.get(editingGroup.telegramId) ?? []) : []}
        onClose={() => setEditingGroup(null)}
        onSaved={async () => {
          try {
            await router.invalidate({ sync: true })
          } catch (error) {
            console.error(error)
            toast.warning("The labels were saved, but the group list could not be refreshed.")
          }
        }}
      />
    </>
  )
}
