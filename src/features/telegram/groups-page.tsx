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
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxChipsGroup,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { getGroupLabelColor, isSameGroupLabel } from "@/features/group-labels/group-labels.constants"
import { LabelDot } from "@/features/group-labels/label-dot"
import { GroupLabelsDialog } from "@/features/telegram/group-labels-dialog"
import { setGroupVisibility } from "@/features/telegram/groups.functions"
import { LeaveGroupDialog } from "@/features/telegram/leave-group-dialog"
import type { TgGroup, TgGroupLabel, TgGroupLabelRelation } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"

const groupColumnHelper = createAppColumnHelper<TgGroup>()

type GroupsFilter = { text: string; requiredLabels: TgGroupLabel[]; excludedLabels: TgGroupLabel[] }
const DEFAULT_GROUPS_FILTER: GroupsFilter = { text: "", requiredLabels: [], excludedLabels: [] }

export function TelegramGroupsPage({
  loadedGroups,
  loadedGroupLabels,
  loadedGroupLabelRelations,
}: {
  loadedGroups: TgGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupLabelRelations: TgGroupLabelRelation[]
}) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setGroupVisibility)
  const [visibilityOverrides, setVisibilityOverrides] = useState<Record<number, boolean>>({})
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [refreshError, setRefreshError] = useState("")
  const [editingGroup, setEditingGroup] = useState<TgGroup | null>(null)

  const groups = loadedGroups.map((group) => ({
    ...group,
    hide: visibilityOverrides[group.telegramId] ?? group.hide,
  }))

  const groupLabelsByName = useMemo(
    () => new Map(loadedGroupLabels.map((label) => [label.label, label])),
    [loadedGroupLabels]
  )

  const labelsByGroupId = useMemo(() => {
    const map = new Map<number, TgGroupLabel[]>()
    for (const relation of loadedGroupLabelRelations) {
      const label = groupLabelsByName.get(relation.label)
      if (!label) continue
      const existing = map.get(relation.groupId)
      if (existing) existing.push(label)
      else map.set(relation.groupId, [label])
    }
    return map
  }, [loadedGroupLabelRelations, groupLabelsByName])

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
        id: "labels",
        header: "Labels",
        cell: ({ row }) => {
          const labels = labelsByGroupId.get(row.original.telegramId)
          if (!labels?.length) return <span className="text-xs italic text-muted-foreground">No labels</span>
          return (
            <div className="flex flex-wrap gap-1">
              {labels.map((label) => {
                const swatch = getGroupLabelColor(label.color)
                return (
                  <Badge
                    key={label.label}
                    className={cn("text-[10px]", swatch.badgeClassName)}
                    style={swatch.badgeStyle}
                  >
                    {label.label}
                  </Badge>
                )
              })}
            </div>
          )
        },
      }),
      groupColumnHelper.display({
        id: "visibility",
        header: "Visibility",
        cell: ({ row }) => {
          const group = row.original
          const pending = updatingId === group.telegramId
          const visible = !group.hide
          return (
            <div onClick={(event) => event.stopPropagation()}>
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
            </div>
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
        id: "leave",
        header: "",
        cell: ({ row }) => (
          <div onClick={(event) => event.stopPropagation()}>
            <LeaveGroupDialog chatId={row.original.telegramId} title={row.original.title} />
          </div>
        ),
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
      globalFilter: DEFAULT_GROUPS_FILTER,
    },
    globalFilterFn: (row, _columnId, value: GroupsFilter | undefined) => {
      const filter = value ?? DEFAULT_GROUPS_FILTER
      const group = row.original
      const query = filter.text.trim().toLocaleLowerCase().replace(/^@/, "")
      const matchesText =
        !query || [group.title, group.tag].filter(Boolean).join(" ").toLocaleLowerCase().includes(query)
      if (!matchesText) return false

      const groupLabels = labelsByGroupId.get(group.telegramId) ?? []
      const matchesRequired = filter.requiredLabels.every((label) => groupLabels.some((gl) => gl.label === label.label))
      const matchesExcluded = filter.excludedLabels.every(
        (label) => !groupLabels.some((gl) => gl.label === label.label)
      )
      return matchesRequired && matchesExcluded
    },
  })
  // SAFETY: globalFilter is only ever set via initialState or updateFilter below, both of which always produce a GroupsFilter.
  const filter: GroupsFilter = (table.state.globalFilter as GroupsFilter | undefined) ?? DEFAULT_GROUPS_FILTER
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(filter.text.trim())
  const activeLabelFilterCount = filter.requiredLabels.length + filter.excludedLabels.length
  const hasFilters = hasSearch || activeLabelFilterCount > 0

  function updateFilter(patch: Partial<GroupsFilter>) {
    table.setGlobalFilter((previous: GroupsFilter | undefined) => ({
      ...(previous ?? DEFAULT_GROUPS_FILTER),
      ...patch,
    }))
    table.setPageIndex(0)
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Telegram groups"
        description="Maintain the community groups connected to PoliNetwork."
        count={filteredCount}
        total={groups.length}
        searchPlaceholder="Search by group name or tag…"
        onSearch={(value) => updateFilter({ text: value })}
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
                  <Combobox
                    items={loadedGroupLabels.filter(
                      (label) => !filter.excludedLabels.some((excluded) => isSameGroupLabel(excluded, label))
                    )}
                    multiple
                    value={filter.requiredLabels}
                    onValueChange={(labels) => updateFilter({ requiredLabels: labels })}
                    itemToStringLabel={(label) => label.label}
                    isItemEqualToValue={isSameGroupLabel}
                  >
                    <ComboboxChipsGroup>
                      <ComboboxChips>
                        <ComboboxValue>
                          {(value: TgGroupLabel[]) =>
                            value.map((label) => (
                              <ComboboxChip key={label.label}>
                                <LabelDot color={label.color} />
                                {label.label}
                                <ComboboxChipRemove aria-label={`Remove ${label.label}`} />
                              </ComboboxChip>
                            ))
                          }
                        </ComboboxValue>
                        <ComboboxChipsInput
                          aria-label="Required labels"
                          placeholder={filter.requiredLabels.length ? "" : "Search labels…"}
                        />
                      </ComboboxChips>
                    </ComboboxChipsGroup>
                    <ComboboxContent>
                      <ComboboxEmpty>No matching labels</ComboboxEmpty>
                      <ComboboxList>
                        {(label: TgGroupLabel) => (
                          <ComboboxItem key={label.label} value={label} className="gap-2">
                            <LabelDot color={label.color} />
                            {label.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Must not have</p>
                  <Combobox
                    items={loadedGroupLabels.filter(
                      (label) => !filter.requiredLabels.some((required) => isSameGroupLabel(required, label))
                    )}
                    multiple
                    value={filter.excludedLabels}
                    onValueChange={(labels) => updateFilter({ excludedLabels: labels })}
                    itemToStringLabel={(label) => label.label}
                    isItemEqualToValue={isSameGroupLabel}
                  >
                    <ComboboxChipsGroup>
                      <ComboboxChips>
                        <ComboboxValue>
                          {(value: TgGroupLabel[]) =>
                            value.map((label) => (
                              <ComboboxChip key={label.label}>
                                <LabelDot color={label.color} />
                                {label.label}
                                <ComboboxChipRemove aria-label={`Remove ${label.label}`} />
                              </ComboboxChip>
                            ))
                          }
                        </ComboboxValue>
                        <ComboboxChipsInput
                          aria-label="Excluded labels"
                          placeholder={filter.excludedLabels.length ? "" : "Search labels…"}
                        />
                      </ComboboxChips>
                    </ComboboxChipsGroup>
                    <ComboboxContent>
                      <ComboboxEmpty>No matching labels</ComboboxEmpty>
                      <ComboboxList>
                        {(label: TgGroupLabel) => (
                          <ComboboxItem key={label.label} value={label} className="gap-2">
                            <LabelDot color={label.color} />
                            {label.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
                {activeLabelFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start text-muted-foreground"
                    onClick={() => updateFilter({ requiredLabels: [], excludedLabels: [] })}
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
            total={filteredCount}
            onPageChange={(page) => table.setPageIndex(page - 1)}
            onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          />
        </>
      ) : (
        <EmptyState
          icon={MessageCircleMore}
          title={hasFilters ? "No groups match this search" : "No Telegram groups yet"}
          text={hasFilters ? "Clear the search or filters and try again." : "No Telegram groups were returned."}
        />
      )}
      <GroupLabelsDialog
        group={editingGroup}
        allLabels={loadedGroupLabels}
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
    </div>
  )
}
