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
import { CreateEditGroupDialog } from "@/features/whatsapp/create-edit-group-dialog"
import { DeleteGroupDialog } from "@/features/whatsapp/delete-group-dialog"
import type { TgGroup, TgGroupLabel, WaGroup } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"

type CombinedGroupRowBase = {
  key: string
  title: string
  tag: string | null
  link: string | null
  labels: TgGroupLabel[]
}

export type CombinedGroupRow =
  | (CombinedGroupRowBase & { platform: "telegram"; group: TgGroup })
  | (CombinedGroupRowBase & { platform: "whatsapp"; group: WaGroup })

const groupColumnHelper = createAppColumnHelper<CombinedGroupRow>()

export function CombinedGroupsTable({
  rows,
  allLabels,
  emptyTitle,
  emptyText,
}: {
  rows: CombinedGroupRow[]
  allLabels: TgGroupLabel[]
  emptyTitle: string
  emptyText: string
}) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setGroupVisibility)
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<number, boolean>>({})
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [refreshError, setRefreshError] = useState("")
  const [editingRow, setEditingRow] = useState<CombinedGroupRow | null>(null)

  const displayRows = rows.map((row) =>
    row.platform === "telegram"
      ? { ...row, group: { ...row.group, hide: visibilityOverrides[row.group.telegramId] ?? row.group.hide } }
      : row
  )

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
      column: Pick<Column<typeof dashboardFeatures, CombinedGroupRow>, "getIsSorted" | "getToggleSortingHandler">
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
            <div className="min-w-0">
              <b className="block truncate">{row.original.title}</b>
              <span className="text-[10px] text-muted-foreground capitalize">{row.original.platform}</span>
            </div>
          </div>
        ),
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
      groupColumnHelper.accessor("labels", {
        header: "Labels",
        cell: ({ getValue }) => <GroupLabelBadges labels={getValue()} />,
      }),
      groupColumnHelper.accessor("link", {
        header: "Invite",
        cell: ({ getValue }) => {
          const link = getValue()
          return link ? (
            <a
              className="rounded-md font-medium text-primary flex items-center gap-1 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
              href={link}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
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
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (row.original.platform === "whatsapp") {
            const group = row.original.group
            return (
              <div onClick={(event) => event.stopPropagation()} className="flex items-center gap-1.5">
                <CreateEditGroupDialog group={group} />
                <DeleteGroupDialog id={group.id} title={group.title} />
              </div>
            )
          }

          const group = row.original.group
          const pending = updatingId === group.telegramId
          const visible = !group.hide
          return (
            <div onClick={(event) => event.stopPropagation()} className="flex items-center gap-1.5">
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
              <LeaveGroupDialog chatId={group.telegramId} title={group.title} />
            </div>
          )
        },
      }),
    ])
  }, [updatingId])

  const table = useAppTable({
    key: "groups-by-label-combined",
    columns,
    data: displayRows,
    initialState: { sorting: [{ id: "title", desc: false }], pagination: { pageIndex: 0, pageSize: 20 } },
  })

  const editingGroupRef =
    editingRow?.platform === "telegram"
      ? { id: editingRow.group.telegramId, title: editingRow.title }
      : editingRow?.platform === "whatsapp"
        ? { id: editingRow.group.id, title: editingRow.title }
        : null
  const editingCurrentLabels = editingRow?.labels ?? []

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
      {displayRows.length ? (
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
                    onClick={() => setEditingRow(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setEditingRow(row.original)
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
            total={displayRows.length}
            onPageChange={(page) => table.setPageIndex(page - 1)}
            onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          />
        </>
      ) : (
        <EmptyState icon={MessageCircleMore} title={emptyTitle} text={emptyText} />
      )}
      <GroupLabelsDialog
        group={editingGroupRef}
        allLabels={allLabels}
        currentLabels={editingCurrentLabels}
        onClose={() => setEditingRow(null)}
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
