import { Bell, Download, IdCard, Pencil, Plus } from "lucide-react"
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
import { Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import { MockupBanner } from "./mockup-banner"
import {
  MOCK_FEE_STATUS,
  MOCK_FEE_STATUSES,
  MOCK_FEE_YEAR,
  MOCK_MEMBER_STATUS,
  MOCK_MEMBER_STATUSES,
  MOCK_MEMBERS,
  type MockFeeStatus,
  type MockMember,
  type MockMemberStatus,
} from "./mockup-data"
import { formatDay } from "./people-format"
import { MonoChip, PersonCell, StateBadge } from "./people-ui"

type Scope = "all" | MockMemberStatus

function matchesQuery(member: MockMember, query: string) {
  if (!query) return true
  return [member.name, member.number, member.m365Email].some((value) => value.toLocaleLowerCase().includes(query))
}

const SORTERS = {
  number: (member: MockMember) => member.number,
  name: (member: MockMember) => member.name,
  admitted: (member: MockMember) => member.admittedOn,
} satisfies Record<string, (member: MockMember) => string>

function sortKey(column: string) {
  if (column === "name") return SORTERS.name
  if (column === "admitted") return SORTERS.admitted
  return SORTERS.number
}

const columns: DataTableColumn<MockMember>[] = [
  {
    id: "number",
    label: "Number",
    sortable: true,
    width: 96,
    mobile: "hidden",
    cell: (member) => <MonoChip>{member.number}</MonoChip>,
  },
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 200,
    mobile: "main",
    cell: (member) => (
      <>
        <PersonCell name={member.name} muted={member.status === "former"} />
        {/* Mobile cards: the number, status and fee on one labelled line. */}
        <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
          <MonoChip>{member.number}</MonoChip>
          <StateBadge state={MOCK_MEMBER_STATUS[member.status]} />
          {member.fee ? (
            <span className="text-xs text-(--pn-fg-muted)">
              Fee {MOCK_FEE_STATUS[member.fee].label.toLocaleLowerCase()}
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
    cell: (member) => <StateBadge state={MOCK_MEMBER_STATUS[member.status]} />,
  },
  {
    id: "admitted",
    label: "Admitted on",
    sortable: true,
    width: 128,
    priority: 3,
    mobile: "hidden",
    cell: (member) => <span className="whitespace-nowrap">{formatDay(member.admittedOn)}</span>,
  },
  {
    id: "fee",
    label: `Fee ${MOCK_FEE_YEAR}`,
    width: 168,
    mobile: "hidden",
    cell: (member) => (member.fee ? <StateBadge state={MOCK_FEE_STATUS[member.fee]} /> : <Unset />),
  },
  {
    id: "m365",
    label: "Microsoft 365",
    width: 264,
    priority: 4,
    mobile: "hidden",
    cell: (member) => <span className="block truncate font-mono text-[13px]">{member.m365Email}</span>,
  },
]

const DEFAULT_SORT: TableSort = { column: "number", direction: "asc" }

/**
 * People › Member register: an unconnected mockup with sample members, kept to be reworked in Phase 2 (#144). It reads
 * nothing from the backend; search, filters and sorting work on the sample rows, and every action is disabled.
 */
export function MembersPage() {
  const members = MOCK_MEMBERS
  const [scope, setScope] = useState<Scope>("all")
  const [fee, setFee] = useState<MockFeeStatus | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const inScope = scope === "all" ? members : members.filter((member) => member.status === scope)
  const filtered = inScope.filter(
    (member) => (fee === null || member.fee === fee) && matchesQuery(member, deferredQuery)
  )
  const key = sortKey(sort.column)
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted((a, b) => key(a).localeCompare(key(b)) * sign)
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || fee !== null
  const current = members.filter((member) => member.status !== "former").length
  const byStatus = (status: MockMemberStatus) => members.filter((member) => member.status === status).length

  function clearFilters() {
    setQuery("")
    setFee(null)
    setPage(1)
  }

  return (
    <>
      <PageBar
        description={`${pluralize(current, "member")} · ${byStatus("former")} former`}
        right={
          <>
            <Button size="sm" variant="outline" className={buttonMotion} disabled>
              <Bell data-icon="inline-start" />
              Send reminders
            </Button>
            <Button size="sm" className={buttonMotion} disabled>
              <Plus data-icon="inline-start" />
              Add member
            </Button>
            <IconButton
              label="Export register"
              icon={Download}
              appearance="boxed"
              className="size-10 max-shell:flex-none"
              disabled
            />
          </>
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
                    ...MOCK_MEMBER_STATUSES.map((status) => ({
                      value: status,
                      label: MOCK_MEMBER_STATUS[status].label,
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
                  <FilterMenu<MockMemberStatus>
                    label="Status"
                    allLabel={`All · ${members.length}`}
                    value={scope === "all" ? null : scope}
                    onChange={(next) => {
                      setScope(next ?? "all")
                      setPage(1)
                    }}
                    options={MOCK_MEMBER_STATUSES.map((status) => ({
                      value: status,
                      label: MOCK_MEMBER_STATUS[status].label,
                      count: byStatus(status),
                    }))}
                  />
                </span>
                <FilterMenu<MockFeeStatus>
                  label={`Fee ${MOCK_FEE_YEAR}`}
                  allLabel="Any fee status"
                  value={fee}
                  onChange={(value) => {
                    setFee(value)
                    setPage(1)
                  }}
                  options={MOCK_FEE_STATUSES.map((status) => ({
                    value: status,
                    label: MOCK_FEE_STATUS[status].label,
                    count: inScope.filter((member) => member.fee === status).length,
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
        <div className="flex flex-col gap-4">
          <MockupBanner phase={2} />
          <DataTable
            label="Member register (mockup)"
            columns={columns}
            rows={rows}
            getRowId={(member) => member.id}
            rowLabel={(member) => member.name}
            rowProps={(member) => ({
              className: member.status === "former" ? "text-(--pn-fg-muted)" : undefined,
            })}
            sort={sort}
            onSort={(next) => {
              setSort(next)
              setPage(1)
            }}
            actions={(member) => (
              <RowActions>
                <IconButton
                  label="Change status"
                  ariaLabel={`Change status of ${member.name}`}
                  icon={Pencil}
                  disabled
                />
              </RowActions>
            )}
            actionsWidth={60}
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
                <EmptyState icon={IdCard} title="No members yet" text="The mockup has no sample members." />
              ) : (
                <EmptyState
                  icon={IdCard}
                  title={`No ${MOCK_MEMBER_STATUS[scope].label.toLocaleLowerCase()} members`}
                  text={MOCK_MEMBER_STATUS[scope].description}
                />
              )
            }
          />
        </div>
      </PageContent>
    </>
  )
}
