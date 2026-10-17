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
  initialsOf,
  type TableSort,
  ToggleFilter,
  Unset,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { AzureMember } from "@/lib/api/types"
import { formatLicense, pluralize } from "@/lib/format"

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
    // Cards: the muted "#id" ends the name's line (`order`: name, id, the rest), so avatars align with or without it.
    className:
      "w-[120px] max-shell:order-[-1] max-shell:ml-auto max-shell:w-auto max-shell:shrink-0 max-shell:self-center",
    mobile: "meta",
    cell: (member) =>
      member.employeeId ? (
        <span className="font-mono text-[13px] text-(--pn-fg-muted)">#{member.employeeId}</span>
      ) : (
        <Unset />
      ),
  },
  {
    id: "displayName",
    label: "Member",
    sortable: true,
    minWidth: 180,
    fill: true,
    className: "max-shell:order-[-2]",
    mobile: "inline",
    cell: (member) => (
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-muted) text-[11px] font-semibold text-(--pn-fg-muted)"
        >
          {initialsOf(memberName(member), member.mail ?? "")}
        </span>
        <Hint overflowOnly label={memberName(member)}>
          <span className="truncate">{memberName(member)}</span>
        </Hint>
      </span>
    ),
  },
  {
    id: "mail",
    label: "Email",
    sortable: true,
    priority: 1,
    minWidth: 220,
    mobile: "full",
    cell: (member) =>
      member.mail ? (
        <Hint overflowOnly label={member.mail}>
          <span className="block max-w-[280px] truncate font-mono text-[13px]">{member.mail}</span>
        </Hint>
      ) : (
        <Unset />
      ),
  },
  {
    id: "licenses",
    label: "Licenses",
    priority: 2,
    minWidth: 260,
    mobile: "full",
    cell: (member) =>
      member.assignedLicensesIds.length ? (
        <ChipOverflow
          items={member.assignedLicensesIds}
          itemLabel={formatLicense}
          renderItem={(license) => (
            <Chip key={license} className="h-6 rounded-(--pn-r-2) bg-(--pn-muted) px-2.25 font-normal">
              {formatLicense(license)}
            </Chip>
          )}
        />
      ) : (
        <span className="inline-flex h-5.5 items-center rounded-full bg-(--pn-warning-bg) px-2 text-xs font-medium whitespace-nowrap text-(--pn-warning-fg)">
          No license
        </span>
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
  const allLicenses = shown.filter((member) => member.assignedLicensesIds.includes("OFFICE_365")).length
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
        description={
          members === null
            ? "Create association members in Microsoft Entra"
            : `${pluralize(shown.length, "member")}, ${pluralize(allLicenses, "license")}`
        }
        left={
          members !== null ? (
            <Toolbar
              search={{ value: query, onChange: changeQuery }}
              filters={
                <ToggleFilter
                  label="Members only"
                  pressed={membersOnly}
                  onPressedChange={(pressed) => {
                    setMembersOnly(pressed)
                    setPage(1)
                  }}
                />
              }
              count={
                filteredView ? (
                  <Count
                    value={filtered.length}
                    total={shown.length}
                    noun="member"
                    parts={[{ value: licenses, noun: "license" }]}
                  />
                ) : undefined
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
