import { useRouter } from "@tanstack/react-router"
import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, Building2, Check, ChevronsUpDown, Plus, UsersRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import type { AzureMember } from "@/lib/api/types"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"
import { MemberDialog, type MemberDialogState } from "./member-dialog"

const memberColumnHelper = createAppColumnHelper<AzureMember>()

type MemberFilter = { query: string; membersOnly: boolean }

function memberFilterFrom(value: unknown): MemberFilter {
  if (!value || typeof value !== "object") return { query: "", membersOnly: false }
  return {
    query: "query" in value && typeof value.query === "string" ? value.query : "",
    membersOnly: "membersOnly" in value && value.membersOnly === true,
  }
}

export function AzureMembersPage({ initialMembers }: { initialMembers: AzureMember[] }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<MemberDialogState | null>(null)
  const [members, setMembers] = useState(initialMembers)

  useEffect(() => setMembers(initialMembers), [initialMembers])

  const columns = useMemo(() => {
    const header = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, AzureMember>, "getIsSorted" | "getToggleSortingHandler">
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
    return memberColumnHelper.columns([
      memberColumnHelper.accessor((member) => member.employeeId ?? undefined, {
        id: "employeeId",
        header: ({ column }) => header("Member ID", column),
        sortUndefined: "last",
        sortFn: (rowA, rowB, columnId) => {
          const a = Number(rowA.getValue(columnId))
          const b = Number(rowB.getValue(columnId))
          return a - b
        },
        cell: ({ getValue }) => getValue() ?? "—",
      }),
      memberColumnHelper.accessor("displayName", {
        header: ({ column }) => header("Member", column),
        cell: ({ row }) => {
          const member = row.original
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent font-mono text-[10px] font-medium text-accent-foreground">
                {member.displayName?.[0] ?? "?"}
              </span>
              <span>
                <b className="block text-xs">{member.displayName ?? "Unnamed member"}</b>
                {member.isMember && (
                  <small className="mt-0.5 block text-[9px] text-muted-foreground">Association member</small>
                )}
              </span>
            </div>
          )
        },
      }),
      memberColumnHelper.accessor("mail", {
        header: ({ column }) => header("Email", column),
        cell: ({ getValue }) =>
          getValue() ?? <span className="text-[11px] italic text-muted-foreground">Not assigned</span>,
      }),
      memberColumnHelper.accessor((member) => member.assignedLicensesIds?.length ?? 0, {
        id: "licenses",
        header: ({ column }) => header("Licenses", column),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.assignedLicensesIds?.length ? (
              row.original.assignedLicensesIds.map((license) => (
                <Badge className="h-5 bg-accent px-1.5 font-mono text-[9px] text-accent-foreground" key={license}>
                  {license.replaceAll("_", " ")}
                </Badge>
              ))
            ) : (
              <span className="text-[11px] italic text-muted-foreground">No licenses</span>
            )}
          </div>
        ),
      }),
      memberColumnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            className="text-primary"
            onClick={() => setDialog({ mode: "edit", member: row.original })}
          >
            Manage
          </Button>
        ),
      }),
    ])
  }, [])
  const table = useAppTable({
    key: "azure-members",
    columns,
    data: members,
    initialState: {
      sorting: [{ id: "employeeId", desc: false }],
      pagination: { pageIndex: 0, pageSize: 25 },
      globalFilter: { query: "", membersOnly: false },
    },
    autoResetPageIndex: false,
    globalFilterFn: (row, _columnId, value) => {
      const filter = memberFilterFrom(value)
      const member = row.original
      return (
        (!filter.membersOnly || !!member.isMember) &&
        `${member.displayName ?? ""} ${member.mail ?? ""} ${member.employeeId ?? ""}`
          .toLocaleLowerCase()
          .includes(filter.query.toLocaleLowerCase())
      )
    },
  })
  const memberFilter = memberFilterFrom(table.state.globalFilter)
  const membersOnly = memberFilter.membersOnly
  const filteredRows = table.getFilteredRowModel().rows

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Azure"
        title="Azure members"
        description="Association membership and Microsoft 365 license information."
        count={filteredRows.length}
        total={members.length}
        searchPlaceholder="Search by name, email, or member ID…"
        onSearch={(value) => {
          table.setGlobalFilter({ ...memberFilter, query: value })
          table.setPageIndex(0)
        }}
        action={
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus data-icon="inline-start" /> Add member
          </Button>
        }
      >
        <Button
          variant="outline"
          size="sm"
          className={cn("text-[10px] text-muted-foreground", membersOnly && "border-primary bg-accent text-primary")}
          aria-pressed={membersOnly}
          onClick={() => {
            table.setGlobalFilter({ ...memberFilter, membersOnly: !membersOnly })
            table.setPageIndex(0)
          }}
        >
          {membersOnly && <Check data-icon="inline-start" />} Members only
        </Button>
      </DataToolbar>
      <section className="mb-4 flex flex-wrap gap-6 rounded-xl border border-border bg-card px-4 py-3.5 text-xs text-muted-foreground shadow-[0_1px_2px_rgb(15_23_42/4%)] max-[600px]:grid max-[600px]:gap-2 dark:shadow-none">
        <div className="flex items-center gap-2">
          <Building2 className="size-6 text-primary" />
          <span>
            <b className="text-primary">{members.filter((member) => member.isMember).length}</b> association members
          </span>
        </div>
        <div className="flex items-center gap-2">
          <UsersRound className="size-6 text-primary" />
          <span>
            <b className="text-primary">
              {members.filter((member) => member.assignedLicensesIds?.includes("OFFICE_365")).length}
            </b>{" "}
            Office 365 licenses
          </span>
        </div>
      </section>
      {filteredRows.length ? (
        <TableSurface>
          <Table className="min-w-[800px] text-left">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-0">
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
                    <TableCell key={cell.id} className="px-4 py-3 text-sm">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableSurface>
      ) : (
        <EmptyState
          icon={UsersRound}
          title={members.length ? "No members match these filters" : "No Azure members yet"}
          text={
            members.length
              ? "Clear the search or turn off the members-only filter."
              : "No members were returned from Microsoft Entra."
          }
        />
      )}
      {filteredRows.length > 0 && (
        <Pagination
          page={table.state.pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          pageSize={table.state.pagination.pageSize}
          total={filteredRows.length}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
        />
      )}
      {dialog && (
        <MemberDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onOptimisticUpdate={(member) => {
            const previous = members.find((current) => current.id === member.id)
            setMembers((current) => current.map((item) => (item.id === member.id ? member : item)))
            return () => {
              if (previous) setMembers((current) => current.map((item) => (item.id === member.id ? previous : item)))
            }
          }}
          onSaved={async (mode) => {
            setDialog(null)
            toast.success(mode === "create" ? "Member created." : "Member ID updated.")
            if (mode === "create") {
              try {
                await router.invalidate({ sync: true })
              } catch (error) {
                console.error(error)
                toast.warning("The member was created, but the latest directory data could not be refreshed.")
              }
            }
          }}
        />
      )}
    </div>
  )
}
