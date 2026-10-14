import { Link } from "@tanstack/react-router"
import { EllipsisVertical, Link2, Mail, Plus, UserRound, UsersRound } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  ChipOverflow,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  RowActions,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import { type AccountAction, AccountActionDialog } from "./account-action-dialog"
import { LinkAccountDialog } from "./link-account-dialog"
import {
  ACCOUNT_STATUS,
  activeTeams,
  CENSUS_ANSWER,
  censusEntry,
  CURRENT_YEAR,
  hasNoRoles,
  isActiveAdmin,
  isMember,
  lastAnswer,
  personName,
  roleLabels,
  teamName,
} from "./people-format"
import { FilterMenu, MonoChip, PersonCell, StateBadge } from "./people-ui"
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
  CAMPUSES,
  type Campus,
  type PersonRow,
  TEAM_IDS,
  type TeamId,
} from "./people.contract"
import { PersonDialog } from "./person-dialog"

type RoleFilter = "member" | "admin" | "team" | "none"
type CensusFilter = "continues" | "leaving" | "none"
type Filters = {
  role: RoleFilter | null
  team: TeamId | null
  campus: Campus | null
  account: AccountStatus | null
  census: CensusFilter | null
}

const NO_FILTERS: Filters = { role: null, team: null, campus: null, account: null, census: null }

const ROLE_TEST = {
  member: isMember,
  admin: isActiveAdmin,
  team: (person) => activeTeams(person).length > 0,
  none: hasNoRoles,
} satisfies Record<RoleFilter, (person: PersonRow) => boolean>

function matchesFilters(person: PersonRow, filters: Filters) {
  if (filters.role && !ROLE_TEST[filters.role](person)) return false
  if (filters.team && !activeTeams(person).some((team) => team.team === filters.team)) return false
  if (filters.campus && person.profile.campus !== filters.campus) return false
  if (filters.account && person.account.status !== filters.account) return false
  if (filters.census) {
    const entry = censusEntry(person, CURRENT_YEAR)
    if (filters.census === "none" ? !entry || entry.answer !== null : entry?.answer !== filters.census) return false
  }
  return true
}

function matchesQuery(person: PersonRow, query: string) {
  if (query === "") return true
  const { profile } = person
  const haystack = `${personName(person)} ${profile.personalEmail ?? ""} ${profile.telegramUsername ?? ""} ${person.id} ${person.member?.number ?? ""}`
  return haystack.toLocaleLowerCase().includes(query.replace(/^@/, ""))
}

const columns: DataTableColumn<PersonRow>[] = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 220,
    mobile: "main",
    cell: (person) => {
      const roles = roleLabels(person)
      return (
        <>
          <PersonCell name={personName(person)} secondary={person.profile.personalEmail} muted={hasNoRoles(person)} />
          {/* Mobile cards: one labelled summary line instead of unlabelled column values. */}
          <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
            {roles.length ? (
              roles.map((role) => <Chip key={role}>{role}</Chip>)
            ) : (
              <span className="text-xs text-(--pn-fg-muted)">No roles</span>
            )}
            <StateBadge state={ACCOUNT_STATUS[person.account.status]} />
          </span>
        </>
      )
    },
  },
  {
    id: "member",
    label: "Member",
    width: 96,
    priority: 3,
    mobile: "hidden",
    cell: (person) => (isMember(person) && person.member ? <MonoChip>{person.member.number}</MonoChip> : <Unset />),
  },
  {
    id: "admin",
    label: "Admin",
    width: 104,
    mobile: "hidden",
    cell: (person) =>
      person.admin ? (
        <StateBadge
          state={
            person.admin.status === "active"
              ? { label: "Active", tone: "success" }
              : { label: "Former", tone: "neutral" }
          }
        />
      ) : (
        <Unset />
      ),
  },
  {
    id: "teams",
    label: "Teams",
    width: 184,
    priority: 2,
    mobile: "hidden",
    cell: (person) => {
      const teams = activeTeams(person)
      return teams.length ? (
        <ChipOverflow
          items={teams.map((team) => team.team)}
          itemLabel={teamName}
          renderItem={(team) => <Chip key={team}>{teamName(team)}</Chip>}
        />
      ) : (
        <Unset />
      )
    },
  },
  {
    id: "capo",
    label: "Capo Admin",
    width: 168,
    priority: 4,
    mobile: "hidden",
    cell: (person) => (person.admin?.capoScope ? <Chip>{person.admin.capoScope}</Chip> : <Unset />),
  },
  {
    id: "account",
    label: "Account",
    width: 136,
    mobile: "hidden",
    cell: (person) => <StateBadge state={ACCOUNT_STATUS[person.account.status]} />,
  },
  {
    id: "census",
    label: "Last census",
    width: 176,
    priority: 1,
    mobile: "hidden",
    cell: (person) => {
      const entry = lastAnswer(person)
      if (!entry?.answer) return <Unset />
      return (
        <span className="whitespace-nowrap">
          <span className="font-mono text-[13px]">{entry.year}</span> · {CENSUS_ANSWER[entry.answer].label}
        </span>
      )
    },
  },
]

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

/** People › Overview: one row per person with their roles, account and last census answer. */
export function PeopleOverviewPage({ people }: { people: PersonRow[] }) {
  const canWrite = useCan("people:write")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [filters, setFilters] = useState(NO_FILTERS)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [addOpen, setAddOpen] = useState(false)
  const [addKey, setAddKey] = useState(0)
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<PersonRow | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)

  const filtered = people.filter((person) => matchesFilters(person, filters) && matchesQuery(person, deferredQuery))
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted((a, b) => personName(a).localeCompare(personName(b)) * sign)
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || Object.values(filters).some((value) => value !== null)

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  function clearFilters() {
    setQuery("")
    setFilters(NO_FILTERS)
    setPage(1)
  }

  function openAdd() {
    setAddKey((key) => key + 1)
    setAddOpen(true)
  }

  function openInvite(person: PersonRow) {
    if (!person.profile.personalEmail) return
    setAccountAction({
      kind: "invite",
      personId: person.id,
      name: personName(person),
      email: person.profile.personalEmail,
    })
    setAccountOpen(true)
  }

  const count = (test: (person: PersonRow) => boolean) => people.filter(test).length

  return (
    <>
      <PageBar
        description={pluralize(people.length, "person")}
        right={
          canWrite ? (
            <Button size="sm" className={buttonMotion} onClick={openAdd}>
              <Plus data-icon="inline-start" />
              Add person
            </Button>
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
            }}
            filters={
              <>
                <FilterMenu<RoleFilter>
                  label="Role"
                  allLabel="All roles"
                  value={filters.role}
                  onChange={(value) => setFilter("role", value)}
                  options={[
                    { value: "member", label: "Member", count: count(ROLE_TEST.member) },
                    { value: "admin", label: "Admin", count: count(ROLE_TEST.admin) },
                    { value: "team", label: "Team member", count: count(ROLE_TEST.team) },
                    { value: "none", label: "No roles", count: count(ROLE_TEST.none) },
                  ]}
                />
                <FilterMenu<TeamId>
                  label="Team"
                  allLabel="All teams"
                  value={filters.team}
                  onChange={(value) => setFilter("team", value)}
                  options={TEAM_IDS.map((team) => ({ value: team, label: teamName(team) }))}
                />
                <FilterMenu<Campus>
                  label="Campus"
                  allLabel="All campuses"
                  value={filters.campus}
                  onChange={(value) => setFilter("campus", value)}
                  options={CAMPUSES.map((campus) => ({ value: campus, label: campus }))}
                />
                <FilterMenu<AccountStatus>
                  label="Account"
                  allLabel="All accounts"
                  value={filters.account}
                  onChange={(value) => setFilter("account", value)}
                  options={ACCOUNT_STATUSES.map((status) => ({
                    value: status,
                    label: ACCOUNT_STATUS[status].label,
                    count: count((person) => person.account.status === status),
                  }))}
                />
                <FilterMenu<CensusFilter>
                  label="Census"
                  allLabel="Any census answer"
                  value={filters.census}
                  onChange={(value) => setFilter("census", value)}
                  options={[
                    { value: "continues", label: `Continues in ${CURRENT_YEAR}` },
                    { value: "leaving", label: `Leaving in ${CURRENT_YEAR}` },
                    { value: "none", label: `No ${CURRENT_YEAR} answer` },
                  ]}
                />
              </>
            }
            count={
              narrowed ? (
                <Count value={filtered.length} total={people.length} noun="person" plural="people" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <DataTable
          label="People"
          columns={columns}
          rows={rows}
          getRowId={(person) => person.id}
          rowLabel={personName}
          rowHref={(person) => `/dashboard/people/${person.id}`}
          rowProps={(person) => ({ className: hasNoRoles(person) ? "text-(--pn-fg-muted)" : undefined })}
          sort={sort}
          onSort={(next) => {
            setSort(next)
            setPage(1)
          }}
          actions={
            canWrite
              ? (person) => (
                  <RowActions>
                    {person.account.status === "none" && person.profile.personalEmail ? (
                      <IconButton
                        label="Send invite"
                        ariaLabel={`Send invite to ${personName(person)}`}
                        icon={Mail}
                        onClick={() => openInvite(person)}
                      />
                    ) : (
                      <span aria-hidden className="size-9 max-shell:hidden" />
                    )}
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
                        <MenuItem render={<Link to="/dashboard/people/$personId" params={{ personId: person.id }} />}>
                          <UserRound />
                          Open record
                        </MenuItem>
                        {person.account.status !== "linked" ? (
                          <MenuItem
                            onClick={() => {
                              setLinkTarget(person)
                              setLinkOpen(true)
                            }}
                          >
                            <Link2 />
                            Link account
                          </MenuItem>
                        ) : null}
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
                icon={UsersRound}
                title="No people match"
                text="Try another search or remove a filter."
                action={
                  <Button size="sm" variant="ghost" className={buttonMotion} onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={UsersRound}
                title="No people yet"
                text="People appear here when you add them or import census answers."
                action={
                  canWrite ? (
                    <Button size="sm" variant="outline" className={buttonMotion} onClick={openAdd}>
                      <Plus data-icon="inline-start" />
                      Add person
                    </Button>
                  ) : undefined
                }
              />
            )
          }
        />
      </PageContent>
      {canWrite ? (
        <>
          <PersonDialog key={addKey} open={addOpen} onOpenChange={setAddOpen} />
          <AccountActionDialog action={accountAction} open={accountOpen} onOpenChange={setAccountOpen} />
          {linkTarget ? (
            <LinkAccountDialog
              key={linkTarget.id}
              open={linkOpen}
              onOpenChange={setLinkOpen}
              person={{ id: linkTarget.id, name: personName(linkTarget), firstName: linkTarget.profile.firstName }}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
