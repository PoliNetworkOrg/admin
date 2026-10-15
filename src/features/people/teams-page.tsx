import { Link } from "@tanstack/react-router"
import { EllipsisVertical, Pencil, UserMinus, UserPlus, UserRound, Users } from "lucide-react"
import { type ReactNode, useDeferredValue, useState } from "react"

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
  MenuSeparator,
  MenuTrigger,
  NavCard,
  PlatformGlyph,
  RecordHeader,
  RowActions,
  SectionHeading,
  SegmentedControl,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan, usePeopleRoles } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import { CENSUS_ANSWER, censusEntry, CURRENT_YEAR, formatDay, NO_ANSWER, personName, teamName } from "./people-format"
import { FilterMenu, PersonCell, StateBadge } from "./people-ui"
import { type PersonRow, type TeamId, type TeamMembership, type TeamSummary, teamFields } from "./people.contract"
import { AddToTeamDialog, EditTeamFieldsDialog, EndTeamMembershipDialog, type TeamMemberTarget } from "./team-dialogs"

/** One person's membership of one team: a table row on the Teams pages. */
type TeamRow = { person: PersonRow; membership: TeamMembership }
type Role = TeamMembership["role"]
type TeamDialog = { kind: "fields" | "end"; target: TeamMemberTarget }

function rowsOf(team: TeamSummary, ended: boolean): TeamRow[] {
  return team.members.flatMap((person) =>
    person.teams
      .filter((membership) => membership.team === team.id && (membership.endedOn !== null) === ended)
      .map((membership) => ({ person, membership }))
  )
}

function rowId(row: TeamRow) {
  return `${row.person.id}-${row.membership.team}-${row.membership.since}`
}

function targetOf(row: TeamRow): TeamMemberTarget {
  return {
    personId: row.person.id,
    name: personName(row.person),
    team: row.membership.team,
    fields: row.membership.fields,
  }
}

function matchesQuery(row: TeamRow, query: string) {
  if (!query) return true
  const fieldValues = Object.values(row.membership.fields).flat()
  return [personName(row.person), row.person.profile.telegramUsername ?? "", ...fieldValues].some((value) =>
    value.toLocaleLowerCase().includes(query)
  )
}

function CensusBadge({ person }: { person: PersonRow }) {
  const entry = censusEntry(person, CURRENT_YEAR)
  if (!entry) return <Unset />
  return <StateBadge state={entry.answer ? CENSUS_ANSWER[entry.answer] : NO_ANSWER} />
}

function PhotoBadge({ person }: { person: PersonRow }) {
  const photo = person.consents.photo
  if (!photo) return <Unset />
  return (
    <StateBadge
      state={
        photo.status === "granted"
          ? { label: "Granted", tone: "success" }
          : { label: photo.status === "denied" ? "Denied" : "Revoked", tone: "neutral" }
      }
    />
  )
}

function RoleChip({ role }: { role: Role }) {
  return <Chip>{role === "lead" ? "Lead" : "Member"}</Chip>
}

/** Edit fields as the row icon, the rest in ⋮. */
function MemberActions({
  row,
  canOpenRecord,
  canAppoint,
  onOpen,
}: {
  row: TeamRow
  canOpenRecord: boolean
  /** Ending a Team Lead's membership is an appointment change: `people:appoint` only. */
  canAppoint: boolean
  onOpen: (dialog: TeamDialog) => void
}) {
  const name = personName(row.person)
  const canEnd = row.membership.role !== "lead" || canAppoint
  return (
    <RowActions>
      <IconButton
        label="Edit team fields"
        ariaLabel={`Edit team fields of ${name}`}
        icon={Pencil}
        onClick={() => onOpen({ kind: "fields", target: targetOf(row) })}
      />
      <Menu>
        <MenuTrigger
          render={<IconButton label="More actions" ariaLabel={`More actions for ${name}`} icon={EllipsisVertical} />}
        />
        <MenuContent>
          {canOpenRecord ? (
            <MenuItem render={<Link to="/dashboard/people/$personId" params={{ personId: row.person.id }} />}>
              <UserRound />
              Open record
            </MenuItem>
          ) : null}
          {canOpenRecord && canEnd ? <MenuSeparator /> : null}
          {canEnd ? (
            <MenuItem variant="destructive" onClick={() => onOpen({ kind: "end", target: targetOf(row) })}>
              <UserMinus />
              End membership
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
    </RowActions>
  )
}

/** The Edit fields / End membership dialog of the row it was opened from. */
function useTeamDialog() {
  const [dialog, setDialog] = useState<TeamDialog | null>(null)
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)
  const element: ReactNode = dialog ? (
    dialog.kind === "fields" ? (
      <EditTeamFieldsDialog key={`fields-${key}`} open={open} onOpenChange={setOpen} target={dialog.target} />
    ) : (
      <EndTeamMembershipDialog key={`end-${key}`} open={open} onOpenChange={setOpen} target={dialog.target} />
    )
  ) : null
  return {
    element,
    show: (next: TeamDialog) => {
      setDialog(next)
      setKey((value) => value + 1)
      setOpen(true)
    },
  }
}

function useAddDialog() {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState(0)
  return {
    open,
    setOpen,
    key,
    show: () => {
      setKey((value) => value + 1)
      setOpen(true)
    },
  }
}

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

function sortRows(rows: TeamRow[], sort: TableSort) {
  const sign = sort.direction === "asc" ? 1 : -1
  return rows.toSorted(
    (a, b) =>
      (sort.column === "since"
        ? a.membership.since.localeCompare(b.membership.since)
        : personName(a.person).localeCompare(personName(b.person))) * sign
  )
}

/** People › Teams: one card per team, then every active team member in one table. */
export function TeamsPage({ teams }: { teams: TeamSummary[] }) {
  const canWrite = useCan("people:write")
  const canAppoint = useCan("people:appoint")
  const all = teams.flatMap((team) => rowsOf(team, false))
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [team, setTeam] = useState<TeamId | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const add = useAddDialog()
  const rowDialog = useTeamDialog()

  const filtered = all.filter(
    (row) =>
      (team === null || row.membership.team === team) &&
      (role === null || row.membership.role === role) &&
      matchesQuery(row, deferredQuery)
  )
  const sorted = sortRows(filtered, sort)
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || team !== null || role !== null

  function resetPage<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  const columns: DataTableColumn<TeamRow>[] = [
    {
      id: "name",
      label: "Name",
      sortable: true,
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (row) => (
        <>
          <PersonCell name={personName(row.person)} secondary={row.person.profile.course} />
          <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
            <Chip>{teamName(row.membership.team)}</Chip>
            {row.membership.role === "lead" ? <Chip>Lead</Chip> : null}
            <CensusBadge person={row.person} />
          </span>
        </>
      ),
    },
    {
      id: "team",
      label: "Team",
      width: 192,
      mobile: "hidden",
      cell: (row) => <Chip>{teamName(row.membership.team)}</Chip>,
    },
    { id: "role", label: "Role", width: 104, mobile: "hidden", cell: (row) => <RoleChip role={row.membership.role} /> },
    {
      id: "since",
      label: "Since",
      sortable: true,
      width: 128,
      priority: 3,
      mobile: "hidden",
      cell: (row) => <span className="whitespace-nowrap">{formatDay(row.membership.since)}</span>,
    },
    {
      id: "census",
      label: `Census ${CURRENT_YEAR}`,
      width: 152,
      priority: 4,
      mobile: "hidden",
      cell: (row) => <CensusBadge person={row.person} />,
    },
    {
      id: "photo",
      label: "Photo and video",
      width: 144,
      priority: 5,
      mobile: "hidden",
      cell: (row) => <PhotoBadge person={row.person} />,
    },
  ]

  return (
    <>
      <PageBar
        description={`${pluralize(teams.length, "team")} · ${pluralize(all.length, "member")}`}
        right={
          canWrite ? (
            <Button size="sm" className={buttonMotion} onClick={add.show}>
              <UserPlus data-icon="inline-start" />
              Add to team
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="flex flex-col gap-8">
          <nav aria-label="Teams" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((summary) => {
              const active = rowsOf(summary, false)
              const missing = active.filter((row) => !censusEntry(row.person, CURRENT_YEAR)?.answer).length
              return (
                <NavCard
                  key={summary.id}
                  title={summary.name}
                  count={active.length}
                  noun="member"
                  description={
                    <>
                      {summary.lead ? `Lead: ${summary.lead.name}` : "No lead"}
                      {missing ? (
                        <span className="text-(--pn-warning-fg)">
                          {" · "}
                          {pluralize(missing, "missing census answer")}
                        </span>
                      ) : null}
                    </>
                  }
                  render={<Link to="/dashboard/people/teams/$teamId" params={{ teamId: summary.id }} />}
                />
              )
            })}
          </nav>

          <section className="flex flex-col gap-3" aria-labelledby="team-members">
            <SectionHeading id="team-members" title="All team members" count={all.length} />
            <Toolbar
              search={{ value: query, onChange: resetPage(setQuery), placeholder: "Search team members…" }}
              filters={
                <>
                  <FilterMenu<TeamId>
                    label="Team"
                    allLabel="All teams"
                    value={team}
                    onChange={resetPage(setTeam)}
                    options={teams.map((summary) => ({
                      value: summary.id,
                      label: summary.name,
                      count: rowsOf(summary, false).length,
                    }))}
                  />
                  <FilterMenu<Role>
                    label="Role"
                    allLabel="Any role"
                    value={role}
                    onChange={resetPage(setRole)}
                    options={[
                      { value: "lead", label: "Lead" },
                      { value: "member", label: "Member" },
                    ]}
                  />
                </>
              }
              count={
                narrowed ? (
                  <Count value={filtered.length} total={all.length} noun="team member" plural="team members" />
                ) : undefined
              }
            />
            <DataTable
              label="All team members"
              columns={columns}
              rows={rows}
              getRowId={rowId}
              rowLabel={(row) => personName(row.person)}
              rowHref={(row) => `/dashboard/people/${row.person.id}`}
              sort={sort}
              onSort={(next) => {
                setSort(next)
                setPage(1)
              }}
              actions={
                canWrite
                  ? (row) => <MemberActions row={row} canOpenRecord canAppoint={canAppoint} onOpen={rowDialog.show} />
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
                    icon={Users}
                    title="No team members match"
                    text="Try another search or remove a filter."
                    action={
                      <Button
                        size="sm"
                        variant="ghost"
                        className={buttonMotion}
                        onClick={() => {
                          setQuery("")
                          setTeam(null)
                          setRole(null)
                          setPage(1)
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState icon={Users} title="No team members yet" text="Add people to a team to see them here." />
                )
              }
            />
          </section>
        </div>
      </PageContent>
      {canWrite ? (
        <AddToTeamDialog
          key={`add-${add.key}`}
          open={add.open}
          onOpenChange={add.setOpen}
          teams={teams.map((summary) => summary.id)}
          canAppoint={canAppoint}
        />
      ) : null}
      {rowDialog.element}
    </>
  )
}

type Scope = "active" | "former"

/**
 * One team. Deep page under Teams for People readers; for a Team Lead without `people:read` it *is* People › Teams
 * (`asSection`), and they get their members' contacts and the team actions.
 */
export function TeamPage({ team, asSection = false }: { team: TeamSummary; asSection?: boolean }) {
  const canRead = useCan("people:read")
  const canWrite = useCan("people:write")
  const canAppoint = useCan("people:appoint")
  const { leads } = usePeopleRoles()
  const isLead = leads.includes(team.id)
  const canEdit = canWrite || isLead
  const showContacts = canRead || isLead
  const fields = teamFields(team.id)
  const optionField = fields.find((field) => field.kind === "multi")
  const active = rowsOf(team, false)
  const former = rowsOf(team, true)

  const [scope, setScope] = useState<Scope>("active")
  const [option, setOption] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const add = useAddDialog()
  const rowDialog = useTeamDialog()

  const inScope = scope === "active" ? active : former
  const filtered = inScope.filter((row) => {
    if (option && optionField) {
      const value = row.membership.fields[optionField.key]
      if (!Array.isArray(value) || !value.includes(option)) return false
    }
    return matchesQuery(row, deferredQuery)
  })
  const rows = sortRows(filtered, sort)
  const narrowed = deferredQuery !== "" || option !== null

  const columns: DataTableColumn<TeamRow>[] = [
    {
      id: "name",
      label: "Name",
      sortable: true,
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (row) => (
        <PersonCell
          name={personName(row.person)}
          secondary={row.person.member?.m365Email ?? row.person.profile.course}
          secondaryMono={row.person.member !== null}
          muted={scope === "former"}
        />
      ),
    },
    { id: "role", label: "Role", width: 104, mobile: "meta", cell: (row) => <RoleChip role={row.membership.role} /> },
    {
      id: "since",
      label: scope === "former" ? "Ended" : "Since",
      sortable: true,
      width: 128,
      priority: 3,
      mobile: "meta",
      cell: (row) => (
        <span className="whitespace-nowrap">
          {formatDay((scope === "former" ? row.membership.endedOn : null) ?? row.membership.since)}
        </span>
      ),
    },
    ...fields.map((field): DataTableColumn<TeamRow> => ({
      id: `field-${field.key}`,
      label: field.label,
      width: field.kind === "multi" ? 208 : 168,
      priority: field.kind === "multi" ? undefined : 4,
      mobile: field.kind === "multi" ? "full" : "hidden",
      cell: (row) => {
        const value = row.membership.fields[field.key]
        if (Array.isArray(value)) {
          return value.length ? (
            <ChipOverflow
              items={value}
              itemLabel={(item) => item}
              renderItem={(item) => <Chip key={item}>{item}</Chip>}
            />
          ) : (
            <Unset />
          )
        }
        return value ? (
          <span className={field.mono ? "block truncate font-mono text-[13px]" : "block truncate"}>{value}</span>
        ) : (
          <Unset />
        )
      },
    })),
    ...(scope === "former"
      ? [
          {
            id: "reason",
            label: "Reason",
            width: 184,
            mobile: "text",
            cell: (row) => row.membership.endReason ?? <Unset />,
          } satisfies DataTableColumn<TeamRow>,
        ]
      : [
          ...(showContacts
            ? [
                {
                  id: "telegram",
                  label: "Telegram",
                  width: 176,
                  priority: 3,
                  mobile: "meta",
                  cell: (row) =>
                    row.person.profile.telegramUsername ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <PlatformGlyph platform="tg" className="size-3.5 shrink-0" />
                        <span className="truncate font-mono text-[13px]">@{row.person.profile.telegramUsername}</span>
                      </span>
                    ) : (
                      <Unset />
                    ),
                } satisfies DataTableColumn<TeamRow>,
                {
                  id: "phone",
                  label: "Phone",
                  width: 160,
                  priority: 5,
                  mobile: "meta",
                  cell: (row) =>
                    row.person.profile.phone ? (
                      <span className="whitespace-nowrap">{row.person.profile.phone}</span>
                    ) : (
                      <Unset />
                    ),
                } satisfies DataTableColumn<TeamRow>,
              ]
            : []),
          {
            id: "census",
            label: `Census ${CURRENT_YEAR}`,
            width: 152,
            priority: 4,
            mobile: "hidden",
            cell: (row) => <CensusBadge person={row.person} />,
          } satisfies DataTableColumn<TeamRow>,
          {
            id: "photo",
            label: "Photo and video",
            width: 144,
            priority: 5,
            mobile: "hidden",
            cell: (row) => <PhotoBadge person={row.person} />,
          } satisfies DataTableColumn<TeamRow>,
        ]),
  ]

  const addButton = canEdit ? (
    <Button size="sm" className={buttonMotion} onClick={add.show}>
      <UserPlus data-icon="inline-start" />
      Add to team
    </Button>
  ) : undefined

  const toolbar = (
    <Toolbar
      search={{
        value: query,
        onChange: setQuery,
        placeholder: `Search ${team.name} members…`,
      }}
      filters={
        <>
          <SegmentedControl<Scope>
            label="Membership"
            items={[
              { value: "active", label: "Active", count: active.length },
              { value: "former", label: "Former", count: former.length },
            ]}
            value={scope}
            onValueChange={setScope}
          />
          {optionField ? (
            <FilterMenu<string>
              label={optionField.label}
              allLabel="Any"
              value={option}
              onChange={setOption}
              options={(optionField.options ?? []).map((value) => ({ value, label: value }))}
            />
          ) : null}
        </>
      }
      count={
        narrowed ? <Count value={filtered.length} total={inScope.length} noun="member" plural="members" /> : undefined
      }
    />
  )

  const table = (
    <DataTable
      label={`${team.name} members`}
      columns={columns}
      rows={rows}
      getRowId={rowId}
      rowLabel={(row) => personName(row.person)}
      rowHref={canRead ? (row) => `/dashboard/people/${row.person.id}` : undefined}
      sort={sort}
      onSort={setSort}
      actions={
        canEdit && scope === "active"
          ? (row) => <MemberActions row={row} canOpenRecord={canRead} canAppoint={canAppoint} onOpen={rowDialog.show} />
          : undefined
      }
      actionsWidth={96}
      empty={
        narrowed ? (
          <EmptyState
            icon={Users}
            title="No members match"
            text="Try another search or remove the filter."
            action={
              <Button
                size="sm"
                variant="ghost"
                className={buttonMotion}
                onClick={() => {
                  setQuery("")
                  setOption(null)
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : scope === "former" ? (
          <EmptyState
            icon={Users}
            title="No former members"
            text="People whose membership ended appear here with the reason."
          />
        ) : (
          <EmptyState icon={Users} title="No members yet" text="Add people to this team to see them here." />
        )
      }
    />
  )

  return (
    <>
      {asSection ? (
        <>
          <PageBar
            title={team.name}
            description={`${pluralize(active.length, "active member")} · you lead this team`}
            right={addButton}
            left={toolbar}
          />
          <PageContent>{table}</PageContent>
        </>
      ) : (
        <>
          <PageBar back={{ label: "teams", link: { to: "/dashboard/people/teams" } }} context={team.name} />
          <PageContent>
            <div className="flex flex-col gap-6">
              <RecordHeader
                title={team.name}
                meta={`${pluralize(active.length, "active member")} · ${team.lead ? `Lead: ${team.lead.name}` : "No lead"}`}
                actions={addButton}
              />
              {toolbar}
              {table}
            </div>
          </PageContent>
        </>
      )}
      {canEdit ? (
        <AddToTeamDialog
          key={`add-${add.key}`}
          open={add.open}
          onOpenChange={add.setOpen}
          team={team.id}
          canAppoint={canAppoint}
        />
      ) : null}
      {rowDialog.element}
    </>
  )
}

/** People › Teams: the index for People readers; a Team Lead without `people:read` gets only their team back. */
export function TeamsSection({ teams }: { teams: TeamSummary[] }) {
  const canRead = useCan("people:read")
  const [led] = teams
  if (!canRead && led) return <TeamPage team={led} asSection />
  return <TeamsPage teams={teams} />
}
