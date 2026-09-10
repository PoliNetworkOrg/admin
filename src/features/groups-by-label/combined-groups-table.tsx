import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, MessageCircleMore, Pencil } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/empty-state"
import { InviteLinkButton, VisibilityToggleButton, EditLabelsButton } from "@/components/group-action-buttons"
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
import { setWhatsappGroupVisibility } from "@/features/whatsapp/groups.functions"
import { useGroupVisibilityToggle } from "@/hooks/use-group-visibility-toggle"
import type { TgGroup, TgGroupLabel, WaGroup } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"

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
  const setWaGroupVisibilityFn = useServerFn(setWhatsappGroupVisibility)
  const {
    updatingId,
    mutationError: tgMutationError,
    refreshError: tgRefreshError,
    resolveHide: resolveTgHide,
    toggleVisibility,
  } = useGroupVisibilityToggle((telegramId: number, hide: boolean) =>
    setGroupVisibilityFn({ data: { telegramId, hide } })
  )
  // Kept as a separate hook instance (not merged into one map) for the same reason as the label maps: Telegram
  // and WhatsApp group ids are independent sequences that could otherwise collide.
  const {
    updatingId: waUpdatingId,
    mutationError: waMutationError,
    refreshError: waRefreshError,
    resolveHide: resolveWaHide,
    toggleVisibility: toggleWaVisibility,
  } = useGroupVisibilityToggle((id: number, hide: boolean) => setWaGroupVisibilityFn({ data: { id, hide } }))
  const mutationError = tgMutationError || waMutationError
  const refreshError = tgRefreshError || waRefreshError
  const [editingKey, setEditingKey] = useState<string | null>(null)

  const displayRows = useMemo(
    () =>
      rows.map((row) =>
        row.platform === "telegram"
          ? { ...row, group: { ...row.group, hide: resolveTgHide(row.group.telegramId, row.group.hide) } }
          : { ...row, group: { ...row.group, hide: resolveWaHide(row.group.id, row.group.hide) } }
      ),
    [rows, resolveTgHide, resolveWaHide]
  )
  const editingRow = editingKey ? (displayRows.find((row) => row.key === editingKey) ?? null) : null

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
      groupColumnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const link = row.original.link

          if (row.original.platform === "whatsapp") {
            const group = row.original.group
            const pending = waUpdatingId === group.id
            const visible = !group.hide
            return (
              <div className="flex items-center justify-end divide-x divide-border">
                <div className="pr-3">
                  <InviteLinkButton link={link} />
                </div>
                <div className="px-3">
                  <VisibilityToggleButton
                    title={group.title}
                    visible={visible}
                    pending={pending}
                    onToggle={() => void toggleWaVisibility(group.id, group.title, group.hide)}
                  />
                </div>
                <div className="flex items-center gap-1.5 px-3">
                  <CreateEditGroupDialog group={group} />
                  <EditLabelsButton title={group.title} onClick={() => setEditingKey(row.original.key)} />
                </div>
                <div className="pl-3">
                  <DeleteGroupDialog id={group.id} title={group.title} />
                </div>
              </div>
            )
          }

          const group = row.original.group
          const pending = updatingId === group.telegramId
          const visible = !group.hide
          return (
            <div className="flex items-center justify-end divide-x divide-border">
              <div className="pr-3">
                <InviteLinkButton link={link} />
              </div>
              <div className="px-3">
                <VisibilityToggleButton
                  title={group.title}
                  visible={visible}
                  pending={pending}
                  onToggle={() => void toggleVisibility(group.telegramId, group.title, group.hide)}
                />
              </div>
              <div className="flex items-center gap-1.5 px-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="border-border bg-muted/30 text-muted-foreground"
                  disabled
                  aria-label={`Editing ${group.title} is not available`}
                >
                  <Pencil />
                </Button>
                <EditLabelsButton title={group.title} onClick={() => setEditingKey(row.original.key)} />
              </div>
              <div className="pl-3">
                <LeaveGroupDialog chatId={group.telegramId} title={group.title} />
              </div>
            </div>
          )
        },
      }),
    ])
  }, [updatingId, waUpdatingId])

  const table = useAppTable({
    key: "groups-by-label-combined",
    columns,
    data: displayRows,
    getRowId: (row) => row.key,
    initialState: { sorting: [{ id: "title", desc: false }], pagination: { pageIndex: 0, pageSize: 20 } },
    autoResetPageIndex: false,
  })

  useEffect(() => {
    const pageCount = table.getPageCount()
    if (table.state.pagination.pageIndex >= pageCount) table.setPageIndex(Math.max(0, pageCount - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayRows.length])

  const editingGroupRef =
    editingRow?.platform === "telegram"
      ? { id: editingRow.group.telegramId, title: editingRow.title, type: "tg" as const }
      : editingRow?.platform === "whatsapp"
        ? { id: editingRow.group.id, title: editingRow.title, type: "wa" as const }
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
        onClose={() => setEditingKey(null)}
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
