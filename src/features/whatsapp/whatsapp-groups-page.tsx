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
  Tag,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { GroupLabelBadges } from "@/features/group-labels/group-label-badges"
import { GroupLabelsDialog } from "@/features/group-labels/group-labels-dialog"
import { isSameGroupLabel } from "@/features/group-labels/group-labels.constants"
import { buildLabelsByGroupId } from "@/features/group-labels/label-tree"
import { LabelTreeSelector } from "@/features/group-labels/label-tree-selector"
import { CreateEditGroupDialog } from "@/features/whatsapp/create-edit-group-dialog"
import { DeleteGroupDialog } from "@/features/whatsapp/delete-group-dialog"
import { setWhatsappGroupVisibility } from "@/features/whatsapp/groups.functions"
import type { GroupWithLabels, TgGroupLabel, WaGroup } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"

function setManyGroupLabels(current: TgGroupLabel[], labels: TgGroupLabel[], select: boolean): TgGroupLabel[] {
  if (select) {
    const toAdd = labels.filter((label) => !current.some((existing) => isSameGroupLabel(existing, label)))
    return [...current, ...toAdd]
  }
  return current.filter((existing) => !labels.some((label) => isSameGroupLabel(existing, label)))
}

const groupColumnHelper = createAppColumnHelper<WaGroup>()

export function WhatsappGroupsPage({
  loadedGroups,
  loadedGroupLabels,
  loadedGroupsWithLabels,
}: {
  loadedGroups: WaGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupsWithLabels: GroupWithLabels[]
}) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setWhatsappGroupVisibility)
  const [query, setQuery] = useState("")
  const [requiredLabels, setRequiredLabels] = useState<TgGroupLabel[]>([])
  const [excludedLabels, setExcludedLabels] = useState<TgGroupLabel[]>([])
  const [editingLabelsGroup, setEditingLabelsGroup] = useState<WaGroup | null>(null)
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<number, boolean>>({})
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [refreshError, setRefreshError] = useState("")

  const labelsByGroupId = useMemo(
    () => buildLabelsByGroupId(loadedGroupLabels, loadedGroupsWithLabels, "wa"),
    [loadedGroupLabels, loadedGroupsWithLabels]
  )

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return loadedGroups
      .filter((group) => {
        const matchesText = !normalizedQuery || group.title.toLocaleLowerCase().includes(normalizedQuery)
        if (!matchesText) return false

        const groupLabels = labelsByGroupId.get(group.id) ?? []
        const matchesRequired = requiredLabels.every((label) => groupLabels.some((gl) => gl.label === label.label))
        const matchesExcluded = excludedLabels.every((label) => !groupLabels.some((gl) => gl.label === label.label))
        return matchesRequired && matchesExcluded
      })
      .map((group) => ({ ...group, hide: visibilityOverrides[group.id] ?? group.hide }))
  }, [loadedGroups, query, requiredLabels, excludedLabels, labelsByGroupId, visibilityOverrides])

  const activeLabelFilterCount = requiredLabels.length + excludedLabels.length
  const hasFilters = Boolean(query.trim()) || activeLabelFilterCount > 0

  async function toggleVisibility(group: WaGroup) {
    if (updatingId !== null) return
    const hide = !group.hide
    setUpdatingId(group.id)
    setMutationError("")
    setVisibilityOverrides((current) => ({ ...current, [group.id]: hide }))

    try {
      await setGroupVisibilityFn({ data: { id: group.id, hide } })
      toast.success(`${group.title} is now ${hide ? "hidden" : "visible"}.`)
      try {
        await router.invalidate({ sync: true })
        setRefreshError("")
        setVisibilityOverrides((current) => {
          const { [group.id]: _removed, ...remaining } = current
          return remaining
        })
      } catch (error) {
        console.error(error)
        setRefreshError("The visibility was updated, but the latest group data could not be refreshed.")
      }
    } catch (error) {
      console.error(error)
      setVisibilityOverrides((current) => {
        const { [group.id]: _removed, ...remaining } = current
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
      column: Pick<Column<typeof dashboardFeatures, WaGroup>, "getIsSorted" | "getToggleSortingHandler">
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
      groupColumnHelper.display({
        id: "labels",
        header: "Labels",
        cell: ({ row }) => <GroupLabelBadges labels={labelsByGroupId.get(row.original.id) ?? []} />,
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
          const group = row.original
          const pending = updatingId === group.id
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
              <CreateEditGroupDialog group={group} />
              <DeleteGroupDialog id={group.id} title={group.title} />
            </div>
          )
        },
      }),
    ])
  }, [labelsByGroupId, updatingId])

  const table = useAppTable({
    key: "whatsapp-groups",
    columns,
    data: visibleGroups,
    getRowId: (group) => String(group.id),
    initialState: { sorting: [{ id: "title", desc: false }], pagination: { pageIndex: 0, pageSize: 20 } },
  })

  return (
    <div className="animate-appear">
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
      <DataToolbar
        eyebrow="WhatsApp"
        title="WhatsApp groups"
        description="Maintain the community groups shared on WhatsApp."
        count={visibleGroups.length}
        total={loadedGroups.length}
        searchPlaceholder="Search by group name…"
        onSearch={setQuery}
        action={<CreateEditGroupDialog />}
      >
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Tag className="size-4" />
                Labels
                {activeLabelFilterCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                    {activeLabelFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-80">
            <PopoverHeader>
              <PopoverTitle>Filter by label</PopoverTitle>
              <PopoverDescription>Show groups that must, or must not, have specific labels.</PopoverDescription>
            </PopoverHeader>
            {loadedGroupLabels.length ? (
              <>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Must have</p>
                  <LabelTreeSelector
                    allLabels={loadedGroupLabels.filter(
                      (label) => !excludedLabels.some((excluded) => isSameGroupLabel(excluded, label))
                    )}
                    selected={requiredLabels}
                    onToggleMany={(labels, select) =>
                      setRequiredLabels((current) => setManyGroupLabels(current, labels, select))
                    }
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Must not have</p>
                  <LabelTreeSelector
                    allLabels={loadedGroupLabels.filter(
                      (label) => !requiredLabels.some((required) => isSameGroupLabel(required, label))
                    )}
                    selected={excludedLabels}
                    onToggleMany={(labels, select) =>
                      setExcludedLabels((current) => setManyGroupLabels(current, labels, select))
                    }
                  />
                </div>
                {activeLabelFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start text-muted-foreground"
                    onClick={() => {
                      setRequiredLabels([])
                      setExcludedLabels([])
                    }}
                  >
                    Clear label filters
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No labels have been created yet.</p>
            )}
          </PopoverContent>
        </Popover>
      </DataToolbar>
      {visibleGroups.length ? (
        <>
          <TableSurface>
            <Table className="min-w-175 text-left">
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
                    onClick={() => setEditingLabelsGroup(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        setEditingLabelsGroup(row.original)
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
            total={visibleGroups.length}
            onPageChange={(page) => table.setPageIndex(page - 1)}
            onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          />
        </>
      ) : (
        <EmptyState
          icon={MessageCircleMore}
          title={hasFilters ? "No groups match this search" : "No WhatsApp groups yet"}
          text={
            hasFilters ? "Clear the search or filters and try again." : "Add the first WhatsApp group to get started."
          }
        />
      )}
      <GroupLabelsDialog
        group={editingLabelsGroup ? { id: editingLabelsGroup.id, title: editingLabelsGroup.title, type: "wa" } : null}
        allLabels={loadedGroupLabels}
        currentLabels={editingLabelsGroup ? (labelsByGroupId.get(editingLabelsGroup.id) ?? []) : []}
        onClose={() => setEditingLabelsGroup(null)}
        onSaved={async () => {
          try {
            await router.invalidate({ sync: true })
          } catch (error) {
            console.error(error)
            toast.warning("The labels were saved, but the group list could not be refreshed.")
          }
        }}
      />
    </div>
  )
}
