import { Crown, Pencil, Send, ShieldPlus, ShieldUser, UserMinus, UserRoundCog } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  ChipOverflow,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  PlatformGlyph,
  RowActions,
  SegmentedControl,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import {
  AppointCapoDialog,
  AssignAdminDialog,
  CapoOfReferenceDialog,
  CapoScopeDialog,
  EndAdminDialog,
  EndCapoDialog,
} from "./admin-dialogs"
import { currentAdmin, formatDay, personName, telegramUrl, waitingForAuth } from "./people-format"
import { useDialog, useDialogState } from "./people-hooks"
import { ActionMenu, AssignmentBadge, PersonCell, RefusalText, TruncatedChip } from "./people-ui"
import type { AdminSummary, CapoSummary, PersonRow } from "./people.contract"

type Tab = "admins" | "capos"
type AdminDialog = { kind: "end" | "capoRef" | "appointCapo"; row: AdminSummary }
type CapoDialog = { kind: "scope" | "end"; row: CapoSummary }

const NO_CAPO = "none"
const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

function TelegramButton({ person }: { person: PersonRow }) {
  if (!person.telegramUsername) return <span aria-hidden className="size-9 max-shell:hidden" />
  return (
    <IconButton
      label="Open in Telegram"
      ariaLabel={`Open ${personName(person)} in Telegram`}
      icon={Send}
      iconNode={<PlatformGlyph platform="tg" className="size-4" />}
      nativeButton={false}
      render={<a href={telegramUrl(person.telegramUsername)} target="_blank" rel="noreferrer" />}
    />
  )
}

function matches(person: PersonRow, query: string, extra: (string | null)[] = []) {
  if (!query) return true
  return [personName(person), person.telegramUsername ?? "", ...extra].some((value) =>
    (value ?? "").toLocaleLowerCase().includes(query.replace(/^@/, ""))
  )
}

const adminColumns: DataTableColumn<AdminSummary>[] = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 220,
    mobile: "main",
    cell: ({ person, admin, capo }) => (
      <>
        <PersonCell
          name={personName(person)}
          secondary={person.telegramUsername ? `@${person.telegramUsername}` : null}
          secondaryMono
        />
        <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
          {capo?.capoScope ? <Chip>Capo Admin · {capo.capoScope}</Chip> : null}
          {admin.capoOfReference ? (
            <span className="text-xs text-(--pn-fg-muted)">Capo Admin: {admin.capoOfReference.name}</span>
          ) : null}
          <AssignmentBadge assignment={admin} />
        </span>
      </>
    ),
  },
  {
    id: "capoOfReference",
    label: "Capo Admin of reference",
    width: 208,
    mobile: "hidden",
    cell: ({ admin, capo }) =>
      capo ? (
        <TruncatedChip label={`Capo Admin · ${capo.capoScope ?? ""}`} />
      ) : admin.capoOfReference ? (
        <span className="block truncate">{admin.capoOfReference.name}</span>
      ) : (
        <Unset />
      ),
  },
  {
    id: "since",
    label: "Since",
    sortable: true,
    width: 128,
    priority: 4,
    mobile: "hidden",
    cell: ({ admin }) => <span className="whitespace-nowrap">{formatDay(admin.since)}</span>,
  },
  {
    id: "status",
    label: "With Auth",
    width: 184,
    priority: 3,
    mobile: "hidden",
    cell: ({ admin }) => <AssignmentBadge assignment={admin} showApplied />,
  },
]

const capoColumns: DataTableColumn<CapoSummary>[] = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 220,
    mobile: "main",
    cell: ({ person, capo }) => (
      <>
        <PersonCell name={personName(person)} secondary={capo.capoScope} />
        <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
          <AssignmentBadge assignment={capo} />
        </span>
        {capo.status === "refused" ? (
          <span className="mt-1 block pl-11">
            <RefusalText refusal={capo.refusal} />
          </span>
        ) : null}
      </>
    ),
  },
  {
    id: "admins",
    label: "Their admins",
    width: 232,
    mobile: "full",
    cell: ({ admins }) =>
      admins.length ? (
        <ChipOverflow
          items={admins.map((admin) => admin.name)}
          max={2}
          itemLabel={(admin) => admin}
          renderItem={(admin) => <TruncatedChip key={admin} label={admin} />}
        />
      ) : (
        <Unset />
      ),
  },
  {
    id: "since",
    label: "Since",
    sortable: true,
    width: 128,
    priority: 4,
    mobile: "hidden",
    cell: ({ capo }) => <span className="whitespace-nowrap">{formatDay(capo.since)}</span>,
  },
  {
    id: "status",
    label: "With Auth",
    width: 184,
    priority: 3,
    mobile: "hidden",
    cell: ({ capo }) => <AssignmentBadge assignment={capo} showApplied />,
  },
]

function sortBy<T extends { person: PersonRow }>(rows: T[], sort: TableSort, since: (row: T) => string) {
  const sign = sort.direction === "asc" ? 1 : -1
  return rows.toSorted(
    (a, b) =>
      (sort.column === "since"
        ? since(a).localeCompare(since(b))
        : personName(a.person).localeCompare(personName(b.person))) * sign
  )
}

/**
 * People › Admins: the current admins of the Telegram groups with their Capo Admin of reference, and the Capo Admins
 * with their scope and admins. Each role shows where it stands with PoliNetwork Auth.
 */
export function AdminsPage({
  admins,
  capos,
  people,
}: {
  admins: AdminSummary[]
  capos: CapoSummary[]
  people: PersonRow[]
}) {
  const canWrite = useCan("people:write")
  const canAppoint = useCan("people:appoint")
  const [tab, setTab] = useState<Tab>("admins")
  const [capoFilter, setCapoFilter] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const assign = useDialogState()
  const appoint = useDialogState()
  const adminDialog = useDialog<AdminDialog>()
  const capoDialog = useDialog<CapoDialog>()

  const filteredAdmins = admins.filter(
    (row) =>
      (capoFilter === null ||
        (capoFilter === NO_CAPO
          ? !row.admin.capoOfReference && !row.capo
          : row.admin.capoOfReference?.id === capoFilter)) &&
      matches(row.person, deferredQuery, [row.admin.capoOfReference?.name ?? null])
  )
  const filteredCapos = capos.filter((row) => matches(row.person, deferredQuery, [row.capo.capoScope]))
  const sortedAdmins = sortBy(filteredAdmins, sort, (row) => row.admin.since)
  const sortedCapos = sortBy(filteredCapos, sort, (row) => row.capo.since)
  const total = tab === "admins" ? sortedAdmins.length : sortedCapos.length
  const narrowed = deferredQuery !== "" || (tab === "admins" && capoFilter !== null)

  const linked = (person: PersonRow) => person.account.status === "linked"
  const option = (person: PersonRow) => ({ id: person.id, name: personName(person), linked: linked(person) })
  const adminCandidates = people.filter((person) => !currentAdmin(person) && !waitingForAuth(person)).map(option)
  const capoCandidates = admins
    .filter((row) => !row.capo && !waitingForAuth(row.person))
    .map((row) => option(row.person))

  function resetPage<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  function clearFilters() {
    setQuery("")
    setCapoFilter(null)
    setPage(1)
  }

  const pagination = {
    page,
    pageSize,
    total,
    onPage: setPage,
    onPageSize: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }
  const pageOf = <T,>(rows: T[]) => rows.slice((page - 1) * pageSize, page * pageSize)

  const noMatch = (
    <EmptyState
      icon={ShieldUser}
      title="Nothing matches"
      text="Try another search or remove the filter."
      action={
        <Button size="sm" variant="ghost" className={buttonMotion} onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  )

  return (
    <>
      <PageBar
        description={`${pluralize(admins.length, "admin")} · ${pluralize(capos.length, "Capo Admin")}`}
        right={
          tab === "admins" ? (
            canWrite ? (
              <Button size="sm" className={buttonMotion} onClick={assign.show}>
                <ShieldPlus data-icon="inline-start" />
                Make admin
              </Button>
            ) : undefined
          ) : canAppoint ? (
            <Button size="sm" className={buttonMotion} onClick={appoint.show}>
              <Crown data-icon="inline-start" />
              Appoint Capo Admin
            </Button>
          ) : undefined
        }
        left={
          <Toolbar
            search={{
              value: query,
              onChange: resetPage(setQuery),
              placeholder: tab === "admins" ? "Search admins…" : "Search Capo Admins or scopes…",
            }}
            filters={
              <>
                <SegmentedControl<Tab>
                  label="Show"
                  items={[
                    { value: "admins", label: "Admins", count: admins.length },
                    { value: "capos", label: "Capo Admins", count: capos.length },
                  ]}
                  value={tab}
                  onValueChange={(value) => {
                    setTab(value)
                    setSort(DEFAULT_SORT)
                    setPage(1)
                  }}
                />
                {tab === "admins" ? (
                  <FilterMenu<string>
                    label="Capo Admin"
                    allLabel="Any Capo Admin"
                    value={capoFilter}
                    onChange={resetPage(setCapoFilter)}
                    options={[
                      {
                        value: NO_CAPO,
                        label: "No Capo Admin",
                        count: admins.filter((row) => !row.admin.capoOfReference && !row.capo).length,
                      },
                      ...capos.map((row) => ({
                        value: row.person.id,
                        label: `${personName(row.person)}${row.capo.capoScope ? ` · ${row.capo.capoScope}` : ""}`,
                        count: row.admins.length,
                      })),
                    ]}
                  />
                ) : null}
              </>
            }
            count={
              narrowed ? (
                tab === "admins" ? (
                  <Count value={filteredAdmins.length} total={admins.length} noun="admin" plural="admins" />
                ) : (
                  <Count value={filteredCapos.length} total={capos.length} noun="Capo Admin" plural="Capo Admins" />
                )
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        {tab === "admins" ? (
          <DataTable
            label="Admins"
            columns={adminColumns}
            rows={pageOf(sortedAdmins)}
            getRowId={(row) => row.person.id}
            rowLabel={(row) => personName(row.person)}
            rowHref={(row) => `/dashboard/people/${row.person.id}`}
            sort={sort}
            onSort={resetPage(setSort)}
            actions={(row) => {
              const waiting = waitingForAuth(row.person)
              return (
                <RowActions>
                  <TelegramButton person={row.person} />
                  <ActionMenu
                    keepSlot
                    label={`More actions for ${personName(row.person)}`}
                    actions={[
                      canWrite &&
                        !row.capo && {
                          label: "Capo Admin of reference",
                          ariaLabel: `Capo Admin of reference for ${personName(row.person)}`,
                          icon: UserRoundCog,
                          onClick: () => adminDialog.show({ kind: "capoRef", row }),
                        },
                      canAppoint &&
                        !row.capo &&
                        !waiting && {
                          label: "Appoint as Capo Admin",
                          ariaLabel: `Appoint ${personName(row.person)} as Capo Admin`,
                          icon: Crown,
                          onClick: () => adminDialog.show({ kind: "appointCapo", row }),
                        },
                      // A Capo Admin's appointment ends first, from Capo Admins.
                      canWrite &&
                        !row.capo &&
                        !waiting && {
                          label: "End admin role",
                          ariaLabel: `End the admin role of ${personName(row.person)}`,
                          icon: UserMinus,
                          destructive: true,
                          onClick: () => adminDialog.show({ kind: "end", row }),
                        },
                    ]}
                  />
                </RowActions>
              )
            }}
            actionsWidth={96}
            pagination={pagination}
            empty={
              narrowed ? (
                noMatch
              ) : (
                <EmptyState
                  icon={ShieldUser}
                  title="No admins yet"
                  text="Admins appear here when you make someone an admin."
                />
              )
            }
          />
        ) : (
          <DataTable
            label="Capo Admins"
            columns={capoColumns}
            rows={pageOf(sortedCapos)}
            getRowId={(row) => row.person.id}
            rowLabel={(row) => personName(row.person)}
            rowHref={(row) => `/dashboard/people/${row.person.id}`}
            sort={sort}
            onSort={resetPage(setSort)}
            actions={(row) => (
              <RowActions>
                <TelegramButton person={row.person} />
                <ActionMenu
                  keepSlot
                  label={`More actions for ${personName(row.person)}`}
                  actions={[
                    canAppoint && {
                      label: "Change scope",
                      ariaLabel: `Change the scope of ${personName(row.person)}`,
                      icon: Pencil,
                      onClick: () => capoDialog.show({ kind: "scope", row }),
                    },
                    canAppoint &&
                      !waitingForAuth(row.person) && {
                        label: "End Capo Admin role",
                        ariaLabel: `End the Capo Admin role of ${personName(row.person)}`,
                        icon: Crown,
                        destructive: true,
                        onClick: () => capoDialog.show({ kind: "end", row }),
                      },
                  ]}
                />
              </RowActions>
            )}
            actionsWidth={96}
            pagination={pagination}
            empty={
              narrowed ? (
                noMatch
              ) : (
                <EmptyState
                  icon={Crown}
                  title="No Capo Admins yet"
                  text="Appoint an admin as Capo Admin to coordinate other admins."
                />
              )
            }
          />
        )}
      </PageContent>
      {canWrite ? (
        <AssignAdminDialog
          key={`assign-${assign.key}`}
          open={assign.open}
          onOpenChange={assign.onOpenChange}
          candidates={adminCandidates}
          capos={capos}
        />
      ) : null}
      {canAppoint ? (
        <AppointCapoDialog
          key={`appoint-${appoint.key}`}
          open={appoint.open}
          onOpenChange={appoint.onOpenChange}
          candidates={capoCandidates}
        />
      ) : null}
      {adminDialog.target ? (
        adminDialog.target.kind === "end" ? (
          <EndAdminDialog
            key={`end-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            target={{ personId: adminDialog.target.row.person.id, name: personName(adminDialog.target.row.person) }}
            linked={linked(adminDialog.target.row.person)}
          />
        ) : adminDialog.target.kind === "capoRef" ? (
          <CapoOfReferenceDialog
            key={`ref-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            target={{ personId: adminDialog.target.row.person.id, name: personName(adminDialog.target.row.person) }}
            current={adminDialog.target.row.admin.capoOfReference?.id ?? null}
            capos={capos}
          />
        ) : (
          <AppointCapoDialog
            key={`appoint-row-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            person={option(adminDialog.target.row.person)}
          />
        )
      ) : null}
      {capoDialog.target ? (
        capoDialog.target.kind === "scope" ? (
          <CapoScopeDialog
            key={`scope-${capoDialog.key}`}
            open={capoDialog.open}
            onOpenChange={capoDialog.onOpenChange}
            target={{ personId: capoDialog.target.row.person.id, name: personName(capoDialog.target.row.person) }}
            scope={capoDialog.target.row.capo.capoScope ?? ""}
          />
        ) : (
          <EndCapoDialog
            key={`end-capo-${capoDialog.key}`}
            open={capoDialog.open}
            onOpenChange={capoDialog.onOpenChange}
            target={{ personId: capoDialog.target.row.person.id, name: personName(capoDialog.target.row.person) }}
            linked={linked(capoDialog.target.row.person)}
            scope={capoDialog.target.row.capo.capoScope ?? ""}
          />
        )
      ) : null}
    </>
  )
}
