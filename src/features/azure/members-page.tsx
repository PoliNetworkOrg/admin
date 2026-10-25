import { useRouter } from "@tanstack/react-router"
import { Check, Pencil, Plus, UsersRound } from "lucide-react"
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  initialsOf,
  RowActions,
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
import { reconcileMemberNumbers } from "./member-number"
import { MemberNumberDialog } from "./member-number-dialog"

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

/** Microsoft 365 members: the directory with member IDs and who is still a member. */
export function AzureMembersPage({ members }: { members: AzureMember[] | null }) {
  const router = useRouter()
  const canCreate = useCan("azure:members:create")
  const canWrite = useCan("azure:members:write")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [membersOnly, setMembersOnly] = useState(false)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)
  /** Kept after closing so the dialog's content survives the exit animation. */
  const [numberTarget, setNumberTarget] = useState<AzureMember | null>(null)
  const [numberOpen, setNumberOpen] = useState(false)
  /** Member IDs saved in this session, shown until the reloaded directory has them. */
  const [optimisticIds, setOptimisticIds] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => {
    setOptimisticIds((current) => reconcileMemberNumbers(current, members))
  }, [members])
  const shown = useMemo(
    () =>
      (members ?? []).map((member) => {
        const employeeId = optimisticIds.get(member.id)
        return employeeId === undefined ? member : { ...member, employeeId }
      }),
    [members, optimisticIds]
  )
  const filtered = shown.filter((member) => (!membersOnly || member.isMember) && matches(member, deferredQuery))
  const sorted = filtered.toSorted((a, b) => compareMembers(a, b, sort))
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const filteredView = deferredQuery !== "" || membersOnly

  async function onSaved(welcomeMailSent: boolean) {
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.warning("The member was created, but the latest directory data could not be refreshed.")
    }
    if (welcomeMailSent) appToast.success("Member created and welcome email sent.")
    else appToast.warning("Member created, but the welcome email couldn't be sent.")
  }

  const applyOptimistic = useCallback(
    (memberId: string, employeeId: string) => {
      const previous = optimisticIds.get(memberId)
      setOptimisticIds((current) => new Map(current).set(memberId, employeeId))
      return () =>
        setOptimisticIds((current) => {
          const next = new Map(current)
          if (previous === undefined) next.delete(memberId)
          else next.set(memberId, previous)
          return next
        })
    },
    [optimisticIds]
  )

  async function onNumberSaved(notified: boolean | null) {
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      // The saved member ID stays on screen; only the rest of the directory is stale.
      console.error(caught)
      appToast.warning("The member ID was changed, but the latest directory data could not be refreshed.")
    }
    if (notified === false) appToast.warning("Member ID changed, but the email to the member couldn't be sent.")
    else appToast.success(notified ? "Member ID changed and email sent." : "Member ID changed.")
  }

  function openNumberDialog(member: AzureMember) {
    setNumberTarget(member)
    setDialogKey((key) => key + 1)
    setNumberOpen(true)
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
          members === null ? "Create association members in Microsoft Entra" : pluralize(shown.length, "member")
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
              count={filteredView ? <Count value={filtered.length} total={shown.length} noun="member" /> : undefined}
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
            actions={
              canWrite
                ? (member) => (
                    <RowActions>
                      <IconButton
                        label="Change member ID"
                        ariaLabel={`Change member ID of ${memberName(member)}`}
                        icon={Pencil}
                        onClick={() => openNumberDialog(member)}
                      />
                    </RowActions>
                  )
                : undefined
            }
            actionsWidth={60}
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
      {canWrite && numberTarget ? (
        <MemberNumberDialog
          key={`number-${dialogKey}`}
          member={numberTarget}
          open={numberOpen}
          onOpenChange={setNumberOpen}
          onOptimisticUpdate={applyOptimistic}
          onSaved={onNumberSaved}
        />
      ) : null}
    </>
  )
}
