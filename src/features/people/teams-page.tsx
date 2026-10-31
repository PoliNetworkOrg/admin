import { Link } from "@tanstack/react-router"
import { Pencil, UserMinus, UserPlus, Users } from "lucide-react"
import { type ReactNode, useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  ChipOverflow,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  NavCard,
  PlatformGlyph,
  RecordHeader,
  RowActions,
  SectionHeading,
  SegmentedControl,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { Count, PageBar, PageContent, Toolbar, useCan, useHasAdminAccess, usePeopleRoles } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import {
  assignmentState,
  formatDay,
  isTeamAssignment,
  personName,
  type TeamAssignment,
  teamName,
  waitingForAuth,
} from "./people-format"
import { useDialog, useDialogState } from "./people-hooks"
import { ActionMenu, AssignmentBadge, PersonCell } from "./people-ui"
import { type PersonRow, type TeamId, type TeamRole, type TeamSummary, teamFields } from "./people.contract"
import { AddToTeamDialog, EditTeamFieldsDialog, EndTeamMembershipDialog, type TeamMemberTarget } from "./team-dialogs"

/** One person's membership of one team: a table row on the Teams pages. */
type TeamRow = { person: PersonRow; membership: TeamAssignment }
type Role = TeamRole
type TeamDialog = { kind: "fields" | "end"; target: TeamMemberTarget }

/**
 * A team's current memberships (`ended` false), or its past ones. An ending Auth hasn't confirmed yet stays with the
 * current ones, with its badge.
 */
function rowsOf(team: TeamSummary, ended: boolean): TeamRow[] {
  return team.members.flatMap((person) =>
    person.assignments
      .filter(isTeamAssignment)
      .filter(
        (membership) =>
          membership.team === team.id && (membership.endedOn !== null && membership.status !== "sent") === ended
      )
      .map((membership) => ({ person, membership }))
  )
}

function rowId(row: TeamRow) {
  return row.membership.id
}

function targetOf(row: TeamRow): TeamMemberTarget {
  return {
    personId: row.person.id,
    name: personName(row.person),
    team: row.membership.team,
    fields: row.membership.fields,
    linked: row.person.account.status === "linked",
  }
}

function matchesQuery(row: TeamRow, query: string) {
  if (!query) return true
  const fieldValues = Object.values(row.membership.fields).flat()
  return [personName(row.person), row.person.telegramUsername ?? "", ...fieldValues].some((value) =>
    value.toLocaleLowerCase().includes(query.replace(/^@/, ""))
  )
}

/** Where the membership stands with Auth; a refusal's reason is the badge's tooltip, and on the person's record. */
function MembershipStatus({ membership }: { membership: TeamAssignment }) {
  return (
    <Hint label={membership.status === "refused" ? membership.refusal : null}>
      <span className="inline-flex min-w-0">
        <AssignmentBadge assignment={membership} />
      </span>
    </Hint>
  )
}

/** Why nobody, or no Lead, can be added: Auth binds no role for it. */
function bindingNote(team: TeamSummary) {
  if (!team.assignable.member && !team.assignable.lead) return "No role bound in PoliNetwork Auth: nobody can be added"
  if (!team.assignable.lead) return "No Lead role bound in PoliNetwork Auth"
  if (!team.assignable.member) return "No member role bound in PoliNetwork Auth"
  return null
}

function RoleChip({ role }: { role: Role }) {
  return <Chip>{role === "lead" ? "Lead" : "Member"}</Chip>
}

/** Edit fields as the row icon, the rest in ⋮. */
function MemberActions({
  row,
  canAppoint,
  onOpen,
}: {
  row: TeamRow
  /** Ending a Team Lead's membership is an appointment change: `people:appoint` only. */
  canAppoint: boolean
  onOpen: (dialog: TeamDialog) => void
}) {
  const name = personName(row.person)
  // Nothing to end while Auth hasn't answered: the backend refuses another change until it does.
  const ending = row.membership.endedOn !== null
  const canEnd = !ending && !waitingForAuth(row.person) && (row.membership.teamRole !== "lead" || canAppoint)
  if (ending) return <span aria-hidden className="size-9" />
  return (
    <RowActions>
      <IconButton
        label="Edit team fields"
        ariaLabel={`Edit team fields of ${name}`}
        icon={Pencil}
        onClick={() => onOpen({ kind: "fields", target: targetOf(row) })}
      />
      <ActionMenu
        keepSlot
        label={`More actions for ${name}`}
        actions={[
          canEnd && {
            label: "End membership",
            ariaLabel: `End the team membership of ${name}`,
            icon: UserMinus,
            destructive: true,
            onClick: () => onOpen({ kind: "end", target: targetOf(row) }),
          },
        ]}
      />
    </RowActions>
  )
}

/** The Edit fields / End membership dialog of the row it was opened from. */
function useTeamDialog() {
  const dialog = useDialog<TeamDialog>()
  const element: ReactNode = dialog.target ? (
    dialog.target.kind === "fields" ? (
      <EditTeamFieldsDialog
        key={`fields-${dialog.key}`}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        target={dialog.target.target}
      />
    ) : (
      <EndTeamMembershipDialog
        key={`end-${dialog.key}`}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        target={dialog.target.target}
      />
    )
  ) : null
  return { element, show: dialog.show }
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
  const hasAdminAccess = useHasAdminAccess()
  const canRead = useCan("people:read") && hasAdminAccess
  const canWrite = useCan("people:write") && hasAdminAccess
  const canAppoint = useCan("people:appoint") && hasAdminAccess
  const all = teams.flatMap((team) => rowsOf(team, false))
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [team, setTeam] = useState<TeamId | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const add = useDialogState()
  const rowDialog = useTeamDialog()

  const filtered = all.filter(
    (row) =>
      (team === null || row.membership.team === team) &&
      (role === null || row.membership.teamRole === role) &&
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
          <PersonCell name={personName(row.person)} />
          <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
            <Chip>{teamName(row.membership.team)}</Chip>
            {row.membership.teamRole === "lead" ? <Chip>Lead</Chip> : null}
            <AssignmentBadge assignment={row.membership} />
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
    {
      id: "role",
      label: "Role",
      width: 104,
      mobile: "hidden",
      cell: (row) => <RoleChip role={row.membership.teamRole} />,
    },
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
      id: "status",
      label: "With Auth",
      width: 200,
      priority: 4,
      mobile: "hidden",
      cell: (row) => <MembershipStatus membership={row.membership} />,
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
              return (
                <NavCard
                  key={summary.id}
                  title={summary.name}
                  count={active.length}
                  noun="member"
                  description={
                    <span className="flex flex-col">
                      <span className="block truncate">{summary.lead ? `Lead: ${summary.lead.name}` : "No Lead"}</span>
                      {bindingNote(summary) ? (
                        <span className="block truncate text-xs text-(--pn-fg-muted)">{bindingNote(summary)}</span>
                      ) : null}
                    </span>
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
              rowHref={canRead ? (row) => `/dashboard/people/${row.person.id}` : undefined}
              sort={sort}
              onSort={(next) => {
                setSort(next)
                setPage(1)
              }}
              actions={
                canWrite
                  ? (row) => <MemberActions row={row} canAppoint={canAppoint} onOpen={rowDialog.show} />
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
          onOpenChange={add.onOpenChange}
          teams={teams.map((summary) => summary.id)}
          availability={teams}
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
  const hasAdminAccess = useHasAdminAccess()
  const canRead = useCan("people:read") && hasAdminAccess
  const canWrite = useCan("people:write") && hasAdminAccess
  const canAppoint = useCan("people:appoint") && hasAdminAccess
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
  const add = useDialogState()
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
      // The Auth column drops first on narrow tables, so a change still waiting or refused also shows here.
      cell: (row) => (
        <PersonCell
          name={personName(row.person)}
          secondary={row.membership.status === "applied" ? null : assignmentState(row.membership).label}
          muted={scope === "former"}
        />
      ),
    },
    {
      id: "role",
      label: "Role",
      width: 104,
      mobile: "meta",
      cell: (row) => <RoleChip role={row.membership.teamRole} />,
    },
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
            cell: (row) =>
              row.membership.status === "refused" ? (
                <MembershipStatus membership={row.membership} />
              ) : (
                (row.membership.endReason ?? <Unset />)
              ),
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
                    row.person.telegramUsername ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <PlatformGlyph platform="tg" className="size-3.5 shrink-0" />
                        <span className="truncate font-mono text-[13px]">@{row.person.telegramUsername}</span>
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
                    row.person.phone ? <span className="whitespace-nowrap">{row.person.phone}</span> : <Unset />,
                } satisfies DataTableColumn<TeamRow>,
              ]
            : []),
          {
            id: "status",
            label: "With Auth",
            width: 200,
            priority: 4,
            mobile: "meta",
            cell: (row) => <MembershipStatus membership={row.membership} />,
          } satisfies DataTableColumn<TeamRow>,
        ]),
  ]

  const addButton =
    canEdit && (team.assignable.member || (canAppoint && team.assignable.lead && !team.lead)) ? (
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
          ? (row) => <MemberActions row={row} canAppoint={canAppoint} onOpen={rowDialog.show} />
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
                meta={[
                  pluralize(active.length, "active member"),
                  team.lead ? `Lead: ${team.lead.name}` : "No Lead",
                  bindingNote(team),
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
          onOpenChange={add.onOpenChange}
          team={team.id}
          availability={[team]}
          canAppoint={canAppoint}
        />
      ) : null}
      {rowDialog.element}
    </>
  )
}

/** People › Teams: the index for People readers; a Team Lead without `people:read` gets only their team back. */
export function TeamsSection({ teams }: { teams: TeamSummary[] }) {
  const hasAdminAccess = useHasAdminAccess()
  const canRead = useCan("people:read") && hasAdminAccess
  const [led] = teams
  if (!canRead && teams.length === 1 && led) return <TeamPage team={led} asSection />
  return <TeamsPage teams={teams} />
}
