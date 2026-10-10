import { useRouter } from "@tanstack/react-router"
import { Plus, UsersRound } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  ChipOverflow,
  DataTable,
  type DataTableColumn,
  EmptyState,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import type { AzureMember } from "@/lib/api/types"
import { formatLicense } from "@/lib/format"

import { MemberDialog } from "./member-dialog"

const DEFAULT_SORT: TableSort = { column: "employeeId", direction: "asc" }

function memberName(member: AzureMember) {
  return member.displayName ?? "Unnamed member"
}

function matches(member: AzureMember, query: string) {
  if (query === "") return true
  return `${member.displayName ?? ""} ${member.mail ?? ""} ${member.employeeId ?? ""}`
    .toLocaleLowerCase()
    .includes(query)
}

/** Missing values sort last in both directions. */
function compareMembers(a: AzureMember, b: AzureMember, sort: TableSort) {
  const sign = sort.direction === "asc" ? 1 : -1
  if (sort.column === "employeeId") {
    if (a.employeeId === null || b.employeeId === null) return a.employeeId === b.employeeId ? 0 : a.employeeId ? -1 : 1
    return (Number(a.employeeId) - Number(b.employeeId)) * sign
  }
  const left = sort.column === "mail" ? a.mail : a.displayName
  const right = sort.column === "mail" ? b.mail : b.displayName
  if (left === null || right === null) return left === right ? 0 : left ? -1 : 1
  return left.localeCompare(right) * sign
}

const columns: DataTableColumn<AzureMember>[] = [
  {
    id: "employeeId",
    label: "Member ID",
    sortable: true,
    align: "end",
    minWidth: 120,
    className: "w-[120px]",
    cell: (member) => member.employeeId ?? <Unset />,
  },
  {
    id: "displayName",
    label: "Member",
    sortable: true,
    minWidth: 180,
    fill: true,
    cell: (member) => (
      <span title={memberName(member)} className="block truncate">
        {memberName(member)}
      </span>
    ),
  },
  {
    id: "mail",
    label: "Email",
    sortable: true,
    priority: 1,
    minWidth: 220,
    cell: (member) =>
      member.mail ? (
        <span title={member.mail} className="block max-w-[280px] truncate">
          {member.mail}
        </span>
      ) : (
        <Unset />
      ),
  },
  {
    id: "licenses",
    label: "Licenses",
    priority: 2,
    minWidth: 260,
    cell: (member) =>
      member.assignedLicensesIds.length ? (
        <ChipOverflow
          items={member.assignedLicensesIds}
          itemLabel={formatLicense}
          renderItem={(license) => <Chip key={license}>{formatLicense(license)}</Chip>}
        />
      ) : (
        <Unset />
      ),
  },
]

/** Microsoft 365 members: the directory with member IDs and licenses. */
export function AzureMembersPage({ members }: { members: AzureMember[] | null }) {
  const router = useRouter()
  const canCreate = useCan("azure:members:create")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [membersOnly, setMembersOnly] = useState(false)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)
  const shown = members ?? []
  const filtered = shown.filter((member) => (!membersOnly || member.isMember) && matches(member, deferredQuery))
  const sorted = filtered.toSorted((a, b) => compareMembers(a, b, sort))
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const licenses = filtered.filter((member) => member.assignedLicensesIds.includes("OFFICE_365")).length
  const filteredView = deferredQuery !== "" || membersOnly

  async function onSaved() {
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.warning("The member was created, but the latest directory data could not be refreshed.")
    }
    appToast.success("Member created.")
  }

  function openDialog() {
    setDialogKey((key) => key + 1)
    setDialogOpen(true)
  }

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function clearFilters() {
    changeQuery("")
    setMembersOnly(false)
  }

  // The empty state repeats the header primary as outline.
  const addMember = (variant: "default" | "outline") => (
    <Button variant={variant} size="sm" className={buttonMotion} onClick={openDialog}>
      <Plus data-icon="inline-start" />
      Add member
    </Button>
  )

  return (
    <>
      <PageBar
        left={
          members !== null ? (
            <Toolbar
              search={{ value: query, onChange: changeQuery, className: "xl:w-80" }}
              filters={
                <Toggle
                  variant="outline"
                  size="lg"
                  pressed={membersOnly}
                  onPressedChange={(pressed) => {
                    setMembersOnly(pressed)
                    setPage(1)
                  }}
                  className="h-9 shrink-0 rounded-(--pn-r-3) border-(--pn-line-strong) px-3 text-[13px] font-medium text-(--pn-fg) transition-[background-color,color,border-color] duration-120 hover:bg-(--pn-muted) aria-pressed:border-[color-mix(in_oklch,var(--pn-accent)_40%,transparent)] aria-pressed:bg-(--pn-accent-soft) aria-pressed:text-(--pn-accent) aria-pressed:hover:bg-(--pn-accent-soft-hover)"
                >
                  Members only
                </Toggle>
              }
              count={
                <Count
                  value={filtered.length}
                  total={filteredView ? shown.length : undefined}
                  noun="member"
                  parts={[{ value: licenses, noun: "license" }]}
                />
              }
            />
          ) : undefined
        }
        right={canCreate ? addMember("default") : undefined}
      />
      <PageContent>
        {members === null ? (
          <EmptyState
            icon={UsersRound}
            title="Create a new member"
            text="You can create members. Viewing the directory requires the member read permission."
          />
        ) : (
          <DataTable
            label="Microsoft 365 members"
            columns={columns}
            rows={rows}
            getRowId={(member) => member.id}
            sort={sort}
            onSort={(next) => {
              setSort(next)
              setPage(1)
            }}
            pagination={{
              page,
              pageSize,
              total: sorted.length,
              onPage: setPage,
              onPageSize: (size) => {
                setPageSize(size)
                setPage(1)
              },
            }}
            empty={
              filteredView ? (
                <EmptyState
                  icon={UsersRound}
                  title="No members match"
                  text="Clear the search or turn off Members only."
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UsersRound}
                  title="No members yet"
                  text="No members were returned from Microsoft Entra."
                  action={canCreate ? addMember("outline") : undefined}
                />
              )
            }
          />
        )}
      </PageContent>
      {canCreate ? (
        <MemberDialog key={dialogKey} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={onSaved} />
      ) : null}
    </>
  )
}
