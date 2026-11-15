import { Link } from "@tanstack/react-router"
import { Check, UsersRound } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  InlineAlert,
  inlineLink,
  initialsOf,
  type TableSort,
  ToggleFilter,
  Unset,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { AzureMember } from "@/lib/api/types"
import { formatLicense, pluralize } from "@/lib/format"

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
    minWidth: 104,
    // Cards: the muted "#id" ends the name's line (`order`: name, id, the rest), so avatars align with or without it.
    className:
      "w-[104px] max-shell:order-[-1] max-shell:ml-auto max-shell:w-auto max-shell:shrink-0 max-shell:self-center",
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
    label: "Name",
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
    priority: 2,
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
    id: "isMember",
    label: "Member",
    priority: 1,
    minWidth: 100,
    // Centered under its header; cards keep the left edge.
    className: "text-center max-shell:text-left",
    mobile: "meta",
    cell: (member) => {
      const licenses = member.assignedLicensesIds.map(formatLicense)
      const status = member.isMember ? "Current member" : "Not a member"
      const detail = licenses.length ? licenses.join(", ") : "No license"
      return (
        // Licenses are a detail: they live in the hint (and the screen-reader text), not in the row. On cards the check
        // gets a visible label and a non-member's cell is dropped (`data-unset`).
        <Hint
          label={
            <span className="flex flex-col gap-0.5">
              <span>{status}</span>
              <span className="opacity-70">Licenses: {detail}</span>
            </span>
          }
        >
          <span
            {...(member.isMember ? {} : { "data-unset": "" })}
            className="inline-grid size-6 place-items-center max-shell:inline-flex max-shell:size-auto max-shell:gap-1.5"
          >
            {member.isMember ? (
              <>
                <Check aria-hidden className="size-4.5 text-(--pn-success-fg)" strokeWidth={2.25} />
                <span aria-hidden className="hidden max-shell:inline">
                  Current member
                </span>
              </>
            ) : null}
            <span className="sr-only max-shell:hidden">
              {status}. Licenses: {detail}
            </span>
          </span>
        </Hint>
      )
    },
  },
]

/**
 * Microsoft 365 members: the directory with member IDs and who is in Soci, read-only. Admitting a socio and changing a
 * member number happen in People › Soci, which keeps the register and Microsoft 365 together.
 */
export function AzureMembersPage({ members }: { members: AzureMember[] }) {
  const canSoci = useCan("soci:read")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [membersOnly, setMembersOnly] = useState(false)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const filtered = members.filter((member) => (!membersOnly || member.isMember) && matches(member, deferredQuery))
  const sorted = filtered.toSorted((a, b) => compareMembers(a, b, sort))
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const filteredView = deferredQuery !== "" || membersOnly

  function changeQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function clearFilters() {
    changeQuery("")
    setMembersOnly(false)
  }

  return (
    <>
      <PageBar
        description={pluralize(members.length, "member")}
        left={
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
            count={filteredView ? <Count value={filtered.length} total={members.length} noun="member" /> : undefined}
          />
        }
      />
      <PageContent>
        <div className="flex flex-col gap-4">
          <InlineAlert tone="info">
            Soci are admitted, and their member numbers changed, in{" "}
            {canSoci ? (
              <Link to="/dashboard/people/soci" className={inlineLink}>
                People › Soci
              </Link>
            ) : (
              "People › Soci"
            )}
            , which keeps the register and Microsoft 365 together.
          </InlineAlert>
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
                />
              )
            }
          />
        </div>
      </PageContent>
    </>
  )
}
