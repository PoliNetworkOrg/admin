import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, Building2, Check, ChevronsUpDown, LoaderCircle, Plus, UsersRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"
import { cn } from "@/lib/utils"
import { createAzureMember, getAzureMembers, setAzureMemberNumber } from "@/server/api.functions"

type AzureMember = {
  id: string
  employeeId?: string | null
  displayName?: string | null
  mail?: string | null
  isMember?: boolean
  assignedLicensesIds?: string[]
}
const memberColumnHelper = createAppColumnHelper<AzureMember>()
type MemberFilter = { query: string; membersOnly: boolean }

export const Route = createFileRoute("/dashboard/azure/members")({
  loader: () => getAzureMembers(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: AzureMembers,
})

function AzureMembers() {
  const response = Route.useLoaderData()
  const router = useRouter()
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; member: AzureMember } | null>(null)
  const loadedMembers = response.data as AzureMember[]
  const [members, setMembers] = useState(loadedMembers)

  useEffect(() => setMembers(loadedMembers), [loadedMembers])

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
      const filter = (value ?? {}) as Partial<MemberFilter>
      const member = row.original
      return (
        (!filter.membersOnly || !!member.isMember) &&
        `${member.displayName ?? ""} ${member.mail ?? ""} ${member.employeeId ?? ""}`
          .toLocaleLowerCase()
          .includes((filter.query ?? "").toLocaleLowerCase())
      )
    },
  })
  const memberFilter = table.state.globalFilter as MemberFilter
  const membersOnly = memberFilter.membersOnly

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Azure"
        title="Azure members"
        description="Association membership and Microsoft 365 license information."
        count={table.getFilteredRowModel().rows.length}
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
      <LiveStatus connected={response.connected} message={response.message} />
      {response.connected && (
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
      )}
      {response.connected &&
        (table.getFilteredRowModel().rows.length ? (
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
        ))}
      {table.getFilteredRowModel().rows.length > 0 && (
        <Pagination
          page={table.state.pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          pageSize={table.state.pagination.pageSize}
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
            if (mode === "create") await router.invalidate({ sync: true })
          }}
        />
      )}
    </div>
  )
}

function MemberDialog({
  dialog,
  onClose,
  onOptimisticUpdate,
  onSaved,
}: {
  dialog: { mode: "create" } | { mode: "edit"; member: AzureMember }
  onClose: () => void
  onOptimisticUpdate: (member: AzureMember) => () => void
  onSaved: (mode: "create" | "edit") => Promise<void>
}) {
  const editing = dialog.mode === "edit"
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [memberId, setMemberId] = useState(editing ? (dialog.member.employeeId ?? "") : "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    const assocNumber = Number.parseInt(memberId, 10)
    if (!Number.isInteger(assocNumber) || assocNumber <= 0) {
      setError("Enter a valid positive member ID.")
      setPending(false)
      return
    }
    let rollback: (() => void) | undefined
    try {
      if (editing) {
        rollback = onOptimisticUpdate({ ...dialog.member, employeeId: String(assocNumber), isMember: true })
        await setAzureMemberNumber({ data: { userId: dialog.member.id, assocNumber } })
        await onSaved("edit")
      } else {
        await createAzureMember({ data: { firstName, lastName, assocNumber, sendEmailTo: email } })
        await onSaved("create")
      }
    } catch {
      rollback?.()
      setError("The member could not be saved. Check the values and your permissions.")
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-lg overflow-hidden border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
            AZURE MEMBERS
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
            {editing ? "Set member ID" : "Create a member"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editing
              ? "Update the association number linked to this Azure account."
              : "Create a member association and send a welcome email."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <FieldGroup className="gap-3.5">
            {!editing && (
              <>
                <Field>
                  <FieldLabel htmlFor="first-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    First name
                  </FieldLabel>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    Last name
                  </FieldLabel>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor="welcome-email"
                    className="font-mono text-[10px] font-medium text-muted-foreground"
                  >
                    Welcome email recipient
                  </FieldLabel>
                  <Input
                    id="welcome-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor="member-id" className="font-mono text-[10px] font-medium text-muted-foreground">
                Member ID
              </FieldLabel>
              <Input
                id="member-id"
                inputMode="numeric"
                pattern="[0-9]+"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value.replace(/\D/g, ""))}
                required
                autoFocus={editing}
              />
            </Field>
            {error && <p className="text-[10px] leading-[1.5] text-destructive">{error}</p>}
          </FieldGroup>
          <DialogFooter className="-mx-6 -mb-5 mt-2 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {editing ? "Save member ID" : "Create member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
