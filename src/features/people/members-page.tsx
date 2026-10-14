import { Link } from "@tanstack/react-router"
import { Download, EllipsisVertical, IdCard, Pencil, Plus, UserRound } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  RowActions,
  SegmentedControl,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import {
  AddMemberDialog,
  ExportMembersDialog,
  MemberNumberDialog,
  MemberStatusDialog,
  nextMemberNumber,
} from "./member-dialogs"
import { ACCOUNT_STATUS, CURRENT_YEAR, FEE_STATUS, formatDay, MEMBER_STATUS, personName } from "./people-format"
import { FilterMenu, MonoChip, PersonCell, StateBadge } from "./people-ui"
import {
  FEE_STATUSES,
  type FeeStatus,
  type Membership,
  MEMBER_STATUSES,
  type MemberStatus,
  type PersonRow,
} from "./people.contract"

type Member = PersonRow & { member: Membership }
type Scope = "all" | MemberStatus
type MemberDialog = { kind: "status" | "number"; member: Member }

function isRegistered(person: PersonRow): person is Member {
  return person.member !== null
}

function matchesQuery(person: Member, query: string) {
  if (!query) return true
  return [personName(person), person.member.number, person.member.m365Email, person.profile.personalEmail ?? ""].some(
    (value) => value.toLocaleLowerCase().includes(query)
  )
}

const SORTERS = {
  number: (person: Member) => person.member.number,
  name: (person: Member) => personName(person),
  admitted: (person: Member) => person.member.admittedOn,
} satisfies Record<string, (person: Member) => string>

function sortKey(column: string) {
  if (column === "name") return SORTERS.name
  if (column === "admitted") return SORTERS.admitted
  return SORTERS.number
}

const columns: DataTableColumn<Member>[] = [
  {
    id: "number",
    label: "Number",
    sortable: true,
    width: 96,
    mobile: "hidden",
    cell: (person) => <MonoChip>{person.member.number}</MonoChip>,
  },
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 200,
    mobile: "main",
    cell: (person) => (
      <>
        <PersonCell name={personName(person)} muted={person.member.status === "former"} />
        {/* Mobile cards: the number, status and fee on one labelled line. */}
        <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
          <MonoChip>{person.member.number}</MonoChip>
          <StateBadge state={MEMBER_STATUS[person.member.status]} />
          {person.member.fee ? (
            <span className="text-xs text-(--pn-fg-muted)">
              Fee {FEE_STATUS[person.member.fee].label.toLocaleLowerCase()}
            </span>
          ) : null}
        </span>
      </>
    ),
  },
  {
    id: "status",
    label: "Status",
    width: 120,
    mobile: "hidden",
    cell: (person) => <StateBadge state={MEMBER_STATUS[person.member.status]} />,
  },
  {
    id: "admitted",
    label: "Admitted on",
    sortable: true,
    width: 128,
    priority: 3,
    mobile: "hidden",
    cell: (person) => <span className="whitespace-nowrap">{formatDay(person.member.admittedOn)}</span>,
  },
  {
    id: "fee",
    label: `Fee ${CURRENT_YEAR}`,
    width: 152,
    mobile: "hidden",
    cell: (person) => (person.member.fee ? <StateBadge state={FEE_STATUS[person.member.fee]} /> : <Unset />),
  },
  {
    id: "m365",
    label: "Microsoft 365",
    width: 264,
    priority: 4,
    mobile: "hidden",
    cell: (person) => <span className="block truncate font-mono text-[13px]">{person.member.m365Email}</span>,
  },
  {
    id: "account",
    label: "Account",
    width: 128,
    priority: 5,
    mobile: "hidden",
    cell: (person) => <StateBadge state={ACCOUNT_STATUS[person.account.status]} />,
  },
]

const DEFAULT_SORT: TableSort = { column: "number", direction: "asc" }

/** People › Member register: every member past and present, by number. */
export function MembersPage({
  people,
  addPersonId,
  onAddHandled,
}: {
  people: PersonRow[]
  /** Opens Add member for this person (from the record's "Add member"). */
  addPersonId?: string
  onAddHandled: () => void
}) {
  const canWrite = useCan("people:members:write")
  const members = people.filter(isRegistered)
  const candidates = people
    .filter((person) => !isRegistered(person))
    .map((person) => ({ id: person.id, name: personName(person) }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const numbers = members.map((person) => person.member.number)
  const takenNumbers = new Set(numbers)
  const nextNumber = nextMemberNumber(numbers)
  const requested = candidates.find((candidate) => candidate.id === addPersonId) ?? null

  const [scope, setScope] = useState<Scope>("all")
  const [fee, setFee] = useState<FeeStatus | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [addOpen, setAddOpen] = useState(canWrite && requested !== null)
  const [addKey, setAddKey] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)
  const [dialog, setDialog] = useState<MemberDialog | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)

  const inScope = scope === "all" ? members : members.filter((person) => person.member.status === scope)
  const filtered = inScope.filter(
    (person) => (fee === null || person.member.fee === fee) && matchesQuery(person, deferredQuery)
  )
  const key = sortKey(sort.column)
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted((a, b) => key(a).localeCompare(key(b)) * sign)
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || fee !== null
  const current = members.filter((person) => person.member.status !== "former").length
  const byStatus = (status: MemberStatus) => members.filter((person) => person.member.status === status).length

  function openAdd() {
    setAddKey((value) => value + 1)
    setAddOpen(true)
  }

  function openDialog(kind: MemberDialog["kind"], member: Member) {
    setDialog({ kind, member })
    setDialogKey((value) => value + 1)
    setDialogOpen(true)
  }

  function clearFilters() {
    setQuery("")
    setFee(null)
    setPage(1)
  }

  const target = dialog
    ? {
        personId: dialog.member.id,
        name: personName(dialog.member),
        number: dialog.member.member.number,
        status: dialog.member.member.status,
        m365Email: dialog.member.member.m365Email,
      }
    : null

  return (
    <>
      <PageBar
        description={`${pluralize(current, "member")} · ${byStatus("former")} former`}
        right={
          canWrite ? (
            <>
              <Button size="sm" variant="outline" className={buttonMotion} onClick={() => setExportOpen(true)}>
                <Download data-icon="inline-start" />
                Export
              </Button>
              <Button size="sm" className={buttonMotion} onClick={openAdd}>
                <Plus data-icon="inline-start" />
                Add member
              </Button>
            </>
          ) : undefined
        }
        left={
          <Toolbar
            search={{
              value: query,
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: "Search by name, number or email…",
            }}
            filters={
              <>
                <SegmentedControl<Scope>
                  label="Member status"
                  items={[
                    { value: "all", label: "All", count: members.length },
                    ...MEMBER_STATUSES.map((status) => ({
                      value: status,
                      label: MEMBER_STATUS[status].label,
                      count: byStatus(status),
                    })),
                  ]}
                  value={scope}
                  onValueChange={(next) => {
                    setScope(next)
                    setPage(1)
                  }}
                />
                <FilterMenu<FeeStatus>
                  label={`Fee ${CURRENT_YEAR}`}
                  allLabel="Any fee status"
                  value={fee}
                  onChange={(value) => {
                    setFee(value)
                    setPage(1)
                  }}
                  options={FEE_STATUSES.map((status) => ({
                    value: status,
                    label: FEE_STATUS[status].label,
                    count: inScope.filter((person) => person.member.fee === status).length,
                  }))}
                />
              </>
            }
            count={
              narrowed ? (
                <Count value={filtered.length} total={inScope.length} noun="member" plural="members" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <DataTable
          label="Member register"
          columns={columns}
          rows={rows}
          getRowId={(person) => person.id}
          rowLabel={personName}
          rowHref={(person) => `/dashboard/people/${person.id}`}
          rowProps={(person) => ({
            className: person.member.status === "former" ? "text-(--pn-fg-muted)" : undefined,
          })}
          sort={sort}
          onSort={(next) => {
            setSort(next)
            setPage(1)
          }}
          actions={
            canWrite
              ? (person) => (
                  <RowActions>
                    <IconButton
                      label="Change status"
                      ariaLabel={`Change status of ${personName(person)}`}
                      icon={Pencil}
                      onClick={() => openDialog("status", person)}
                    />
                    <Menu>
                      <MenuTrigger
                        render={
                          <IconButton
                            label="More actions"
                            ariaLabel={`More actions for ${personName(person)}`}
                            icon={EllipsisVertical}
                          />
                        }
                      />
                      <MenuContent>
                        <MenuItem onClick={() => openDialog("number", person)}>
                          <IdCard />
                          Change member number
                        </MenuItem>
                        <MenuItem render={<Link to="/dashboard/people/$personId" params={{ personId: person.id }} />}>
                          <UserRound />
                          Open record
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </RowActions>
                )
              : undefined
          }
          actionsWidth={96}
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
            narrowed ? (
              <EmptyState
                icon={IdCard}
                title="No members match"
                text="Try another search or remove the fee filter."
                action={
                  <Button size="sm" variant="ghost" className={buttonMotion} onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : scope === "all" ? (
              <EmptyState
                icon={IdCard}
                title="No members yet"
                text="Members appear here once the Direttivo admits them."
                action={
                  canWrite ? (
                    <Button size="sm" variant="outline" className={buttonMotion} onClick={openAdd}>
                      <Plus data-icon="inline-start" />
                      Add member
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <EmptyState
                icon={IdCard}
                title={`No ${MEMBER_STATUS[scope].label.toLocaleLowerCase()} members`}
                text={MEMBER_STATUS[scope].description}
              />
            )
          }
        />
      </PageContent>
      {canWrite ? (
        <>
          <AddMemberDialog
            key={`add-${addKey}`}
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open)
              if (!open && addPersonId) onAddHandled()
            }}
            candidates={candidates}
            initialPerson={addKey === 0 ? requested : null}
            nextNumber={nextNumber}
            takenNumbers={takenNumbers}
          />
          <ExportMembersDialog open={exportOpen} onOpenChange={setExportOpen} count={members.length} />
          {dialog && target ? (
            dialog.kind === "status" ? (
              <MemberStatusDialog
                key={`status-${dialogKey}`}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                member={target}
              />
            ) : (
              <MemberNumberDialog
                key={`number-${dialogKey}`}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                member={target}
                nextNumber={nextNumber}
                takenNumbers={takenNumbers}
              />
            )
          ) : null}
        </>
      ) : null}
    </>
  )
}
