import { Banknote, Bell, Download, FileSearch, IdCard, Pencil, Plus } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  RowActions,
  SegmentedControl,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import {
  type FeeTarget,
  MarkPaidDialog,
  ReviewReceiptDialog,
  SendFeeRemindersDialog,
  useSendFeeReminder,
} from "./fee-dialogs"
import {
  AddMemberDialog,
  ExportMembersDialog,
  MemberNumberDialog,
  MemberStatusDialog,
  nextMemberNumber,
} from "./member-dialogs"
import { ACCOUNT_STATUS, currentYear, FEE_STATUS, formatDay, MEMBER_STATUS, personName } from "./people-format"
import { useDialog, useDialogState } from "./people-hooks"
import { ActionMenu, MonoChip, PersonCell, StateBadge } from "./people-ui"
import {
  FEE_STATUSES,
  type FeeStatus,
  type Membership,
  MEMBER_STATUSES,
  type MemberStatus,
  type MemberRegisterRow,
} from "./people.contract"

type Member = MemberRegisterRow & { member: Membership }
type Scope = "all" | MemberStatus
type MemberDialog = { kind: "status" | "number"; member: Member }
type FeeDialog = { kind: "review" | "paid"; person: FeeTarget }

function isRegistered(person: MemberRegisterRow): person is Member {
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

/** The table's columns; the census and fee columns name the current academic year. */
function tableColumns(year: string): DataTableColumn<Member>[] {
  return [
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
      label: `Fee ${year}`,
      width: 168,
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
}

const DEFAULT_SORT: TableSort = { column: "number", direction: "asc" }

/** People › Member register: every member past and present, by number. */
export function MembersPage({
  people,
  addPersonId,
  onAddHandled,
}: {
  people: MemberRegisterRow[]
  /** Opens Add member for this person (from the record's "Add member"). */
  addPersonId?: string
  onAddHandled: () => void
}) {
  const canRead = useCan("people:read")
  const canWrite = useCan("people:members:write")
  const canFees = useCan("people:fees:write")
  const year = currentYear()
  const sendReminder = useSendFeeReminder()
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
  const add = useDialogState(canWrite && requested !== null)
  const exportDialog = useDialogState()
  const reminders = useDialogState()
  const memberDialog = useDialog<MemberDialog>()
  const feeDialog = useDialog<FeeDialog>()

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

  function openFee(kind: FeeDialog["kind"], member: Member) {
    feeDialog.show({ kind, person: { id: member.id, name: personName(member), number: member.member.number } })
  }

  const owing = members.filter(
    (person) => person.member.status !== "former" && (person.member.fee === "due" || person.member.fee === "unpaid")
  ).length

  function clearFilters() {
    setQuery("")
    setFee(null)
    setPage(1)
  }

  const dialog = memberDialog.target
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
          canWrite || canFees ? (
            <>
              {/* One outline action (Send reminders); Export is an icon so it stays in the same place for everyone. */}
              {canFees ? (
                <Button size="sm" variant="outline" className={buttonMotion} onClick={reminders.show}>
                  <Bell data-icon="inline-start" />
                  Send reminders
                </Button>
              ) : null}
              {canWrite ? (
                <>
                  <Button size="sm" className={buttonMotion} onClick={add.show}>
                    <Plus data-icon="inline-start" />
                    Add member
                  </Button>
                  <IconButton
                    label="Export register"
                    icon={Download}
                    appearance="boxed"
                    className="size-10 max-shell:flex-none"
                    onClick={exportDialog.show}
                  />
                </>
              ) : null}
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
                  className="max-shell:hidden"
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
                {/* Five statuses don't fit beside the fee filter on phones: the same choice as a menu. */}
                <span className="shell:hidden">
                  <FilterMenu<MemberStatus>
                    label="Status"
                    allLabel={`All · ${members.length}`}
                    value={scope === "all" ? null : scope}
                    onChange={(next) => {
                      setScope(next ?? "all")
                      setPage(1)
                    }}
                    options={MEMBER_STATUSES.map((status) => ({
                      value: status,
                      label: MEMBER_STATUS[status].label,
                      count: byStatus(status),
                    }))}
                  />
                </span>
                <FilterMenu<FeeStatus>
                  label={`Fee ${year}`}
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
          columns={tableColumns(year)}
          rows={rows}
          getRowId={(person) => person.id}
          rowLabel={personName}
          rowHref={canRead ? (person) => `/dashboard/people/${person.id}` : undefined}
          rowProps={(person) => ({
            className: person.member.status === "former" ? "text-(--pn-fg-muted)" : undefined,
          })}
          sort={sort}
          onSort={(next) => {
            setSort(next)
            setPage(1)
          }}
          actions={
            canWrite || canFees
              ? (person) => (
                  <RowActions>
                    {/* The fee's own action, by state; Paid and former members keep an empty slot so icons align. */}
                    {canFees ? (
                      person.member.status !== "former" && person.member.fee === "receipt" ? (
                        <IconButton
                          label="Review receipt"
                          ariaLabel={`Review the receipt of ${personName(person)}`}
                          icon={FileSearch}
                          onClick={() => openFee("review", person)}
                        />
                      ) : person.member.status !== "former" &&
                        (person.member.fee === "due" || person.member.fee === "unpaid") ? (
                        <IconButton
                          label="Send reminder"
                          ariaLabel={`Send a fee reminder to ${personName(person)}`}
                          icon={Bell}
                          onClick={() => void sendReminder({ id: person.id, name: personName(person) })}
                        />
                      ) : (
                        <span aria-hidden className="size-9 shrink-0" />
                      )
                    ) : null}
                    {canWrite ? (
                      <IconButton
                        label="Change status"
                        ariaLabel={`Change status of ${personName(person)}`}
                        icon={Pencil}
                        onClick={() => memberDialog.show({ kind: "status", member: person })}
                      />
                    ) : null}
                    <ActionMenu
                      keepSlot
                      label={`More actions for ${personName(person)}`}
                      actions={[
                        canFees &&
                          person.member.status !== "former" &&
                          (person.member.fee === "due" || person.member.fee === "unpaid") && {
                            label: "Mark as paid",
                            ariaLabel: `Mark the fee of ${personName(person)} as paid`,
                            icon: Banknote,
                            onClick: () => openFee("paid", person),
                          },
                        canWrite && {
                          label: "Change member number",
                          ariaLabel: `Change the member number of ${personName(person)}`,
                          icon: IdCard,
                          onClick: () => memberDialog.show({ kind: "number", member: person }),
                        },
                      ]}
                    />
                  </RowActions>
                )
              : undefined
          }
          actionsWidth={(canFees ? 38 : 0) + (canWrite ? 38 : 0) + 40}
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
                    <Button size="sm" variant="outline" className={buttonMotion} onClick={add.show}>
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
      {canFees ? (
        <SendFeeRemindersDialog open={reminders.open} onOpenChange={reminders.onOpenChange} count={owing} />
      ) : null}
      {canFees && feeDialog.target ? (
        feeDialog.target.kind === "review" ? (
          <ReviewReceiptDialog
            key={`review-${feeDialog.key}`}
            open={feeDialog.open}
            onOpenChange={feeDialog.onOpenChange}
            person={feeDialog.target.person}
          />
        ) : (
          <MarkPaidDialog
            key={`paid-${feeDialog.key}`}
            open={feeDialog.open}
            onOpenChange={feeDialog.onOpenChange}
            person={feeDialog.target.person}
          />
        )
      ) : null}
      {canWrite ? (
        <>
          <AddMemberDialog
            key={`add-${add.key}`}
            open={add.open}
            onOpenChange={(open) => {
              add.onOpenChange(open)
              if (!open && addPersonId) onAddHandled()
            }}
            candidates={candidates}
            initialPerson={add.key === 0 ? requested : null}
            nextNumber={nextNumber}
            takenNumbers={takenNumbers}
          />
          <ExportMembersDialog
            open={exportDialog.open}
            onOpenChange={exportDialog.onOpenChange}
            count={members.length}
          />
          {dialog && target ? (
            dialog.kind === "status" ? (
              <MemberStatusDialog
                key={`status-${memberDialog.key}`}
                open={memberDialog.open}
                onOpenChange={memberDialog.onOpenChange}
                member={target}
              />
            ) : (
              <MemberNumberDialog
                key={`number-${memberDialog.key}`}
                open={memberDialog.open}
                onOpenChange={memberDialog.onOpenChange}
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
