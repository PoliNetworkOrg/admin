import { Crown, Send, ShieldUser, UserMinus, UserRoundCog } from "lucide-react"
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
  ToggleFilter,
  Unset,
  useOpenGeneration,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import {
  type AdminTarget,
  CapoOfReferenceDialog,
  CapoScopeDialog,
  EndAdminDialog,
  EndCapoDialog,
} from "./admin-dialogs"
import { formatDay, personName, telegramUrl, yearOf } from "./people-format"
import { ActionMenu, PersonCell, TruncatedChip } from "./people-ui"
import { type AdminRole, CAMPUSES, type Campus, type PersonRow, YEARS } from "./people.contract"

type Admin = PersonRow & { admin: AdminRole }
type Scope = "active" | "former"
type Year = (typeof YEARS)[number]
type Quick = "availableAsCapo"
type AdminDialog = { kind: "end" | "capoRef" | "capoScope" | "endCapo"; admin: Admin }

function isAdmin(person: PersonRow): person is Admin {
  return person.admin !== null
}

const QUICK = {
  availableAsCapo: { label: "Available as Capo Admin", test: (person: Admin) => person.admin.availableAsCapo },
} satisfies Record<Quick, { label: string; test: (person: Admin) => boolean }>

const QUICK_IDS = ["availableAsCapo"] satisfies Quick[]

function matchesQuery(person: Admin, query: string) {
  if (!query) return true
  return [personName(person), person.profile.course, person.profile.telegramUsername ?? ""].some((value) =>
    value.toLocaleLowerCase().includes(query)
  )
}

function tableColumns(): DataTableColumn<Admin>[] {
  return [
    {
      id: "name",
      label: "Name",
      sortable: true,
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (person) => (
        <>
          <PersonCell
            name={personName(person)}
            secondary={person.profile.course}
            muted={person.admin.status === "former"}
          />
          {/* Mobile cards: the admin role on one line, then the Capo Admin scope. */}
          <span className="mt-2 hidden flex-col items-start gap-1.5 pl-11 text-xs text-(--pn-fg-muted) max-shell:flex">
            <span>
              {person.admin.status !== "active" ? "Former admin" : `Admin since ${formatDay(person.admin.since)}`}
            </span>
            {person.admin.capoScope ? <Chip>Capo Admin · {person.admin.capoScope}</Chip> : null}
          </span>
        </>
      ),
    },
    {
      id: "year",
      label: "Year",
      width: 112,
      priority: 4,
      mobile: "hidden",
      cell: (person) => <span className="whitespace-nowrap">{person.profile.year}</span>,
    },
    {
      id: "campus",
      label: "Campus",
      width: 112,
      priority: 5,
      mobile: "hidden",
      cell: (person) => person.profile.campus,
    },
    {
      id: "since",
      label: "Active since",
      sortable: true,
      width: 128,
      priority: 5,
      mobile: "hidden",
      cell: (person) =>
        person.admin.status === "former" ? (
          <span className="whitespace-nowrap text-(--pn-fg-muted)">Ended {formatDay(person.admin.endedOn ?? "")}</span>
        ) : (
          <span className="whitespace-nowrap">{formatDay(person.admin.since)}</span>
        ),
    },
    {
      id: "representative",
      label: "Representative",
      width: 184,
      priority: 6,
      mobile: "hidden",
      cell: (person) =>
        person.profile.studentRepresentative ? (
          <span className="block truncate">{person.profile.studentRepresentative}</span>
        ) : (
          <Unset />
        ),
    },
    {
      id: "associations",
      label: "Other associations",
      width: 168,
      priority: 6,
      mobile: "hidden",
      cell: (person) =>
        person.profile.otherAssociations.length ? (
          <ChipOverflow
            items={person.profile.otherAssociations}
            max={1}
            itemLabel={(association) => association}
            renderItem={(association) => <TruncatedChip key={association} label={association} />}
          />
        ) : (
          <Unset />
        ),
    },
    {
      id: "availableAsCapo",
      label: "Available as Capo",
      width: 144,
      priority: 6,
      mobile: "hidden",
      cell: (person) => (person.admin.availableAsCapo ? "Yes" : <Unset />),
    },
    {
      id: "capoOfReference",
      label: "Capo Admin of reference",
      width: 184,
      priority: 3,
      mobile: "hidden",
      cell: (person) =>
        person.admin.capoScope ? (
          <TruncatedChip label={`Capo Admin · ${person.admin.capoScope}`} />
        ) : person.admin.capoOfReference ? (
          <span className="block truncate">{person.admin.capoOfReference.name}</span>
        ) : (
          <Unset />
        ),
    },
  ]
}

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

/** People › Admins: admins of the Telegram course groups and their Capo Admin. */
export function AdminsPage({ people }: { people: PersonRow[] }) {
  const canWrite = useCan("people:write")
  const canAppoint = useCan("people:appoint")
  const admins = people.filter(isAdmin)
  const active = admins.filter((person) => person.admin.status === "active")

  const [scope, setScope] = useState<Scope>("active")
  const [campus, setCampus] = useState<Campus | null>(null)
  const [year, setYear] = useState<Year | null>(null)
  const [quick, setQuick] = useState<ReadonlySet<Quick>>(new Set())
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dialog, setDialog] = useState<AdminDialog | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const dialogKey = useOpenGeneration(dialogOpen)

  const inScope = admins.filter((person) => person.admin.status === scope)
  const filtered = inScope.filter(
    (person) =>
      (campus === null || person.profile.campus === campus) &&
      (year === null || yearOf(person.profile.year) === year) &&
      [...quick].every((id) => QUICK[id].test(person)) &&
      matchesQuery(person, deferredQuery)
  )
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted(
    (a, b) =>
      (sort.column === "since"
        ? a.admin.since.localeCompare(b.admin.since)
        : personName(a).localeCompare(personName(b))) * sign
  )
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const narrowed = deferredQuery !== "" || campus !== null || year !== null || quick.size > 0

  function resetPage<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value)
      setPage(1)
    }
  }

  function toggleQuick(id: Quick, pressed: boolean) {
    setQuick((current) => {
      const next = new Set(current)
      if (pressed) next.add(id)
      else next.delete(id)
      return next
    })
    setPage(1)
  }

  function clearFilters() {
    setQuery("")
    setCampus(null)
    setYear(null)
    setQuick(new Set())
    setPage(1)
  }

  function open(kind: AdminDialog["kind"], admin: Admin) {
    setDialog({ kind, admin })
    setDialogOpen(true)
  }

  const target: AdminTarget | null = dialog ? { personId: dialog.admin.id, name: personName(dialog.admin) } : null

  return (
    <>
      <PageBar
        description={`${pluralize(active.length, "active admin")} of Telegram course groups`}
        left={
          <Toolbar
            search={{
              value: query,
              onChange: resetPage(setQuery),
              placeholder: "Search by name, course or username…",
            }}
            filters={
              <>
                <SegmentedControl<Scope>
                  label="Admin status"
                  items={[
                    { value: "active", label: "Active", count: active.length },
                    { value: "former", label: "Former", count: admins.length - active.length },
                  ]}
                  value={scope}
                  onValueChange={resetPage(setScope)}
                />
                <FilterMenu<Campus>
                  label="Campus"
                  allLabel="All campuses"
                  value={campus}
                  onChange={resetPage(setCampus)}
                  options={CAMPUSES.map((value) => ({ value, label: value }))}
                />
                <FilterMenu<Year>
                  label="Year"
                  allLabel="All years"
                  value={year}
                  onChange={resetPage(setYear)}
                  options={YEARS.map((value) => ({ value, label: value }))}
                />
                {QUICK_IDS.map((id) => (
                  <ToggleFilter
                    key={id}
                    label={QUICK[id].label}
                    count={inScope.filter(QUICK[id].test).length}
                    pressed={quick.has(id)}
                    onPressedChange={(pressed) => toggleQuick(id, pressed)}
                  />
                ))}
              </>
            }
            count={
              narrowed ? (
                <Count
                  value={filtered.length}
                  total={inScope.length}
                  noun={scope === "former" ? "former admin" : "admin"}
                  plural={scope === "former" ? "former admins" : "admins"}
                />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <DataTable
          label="Admins"
          columns={tableColumns()}
          rows={rows}
          getRowId={(person) => person.id}
          rowLabel={personName}
          rowHref={(person) => `/dashboard/people/${person.id}`}
          rowProps={(person) => ({
            className: person.admin.status === "former" ? "text-(--pn-fg-muted)" : undefined,
          })}
          sort={sort}
          onSort={(next) => {
            setSort(next)
            setPage(1)
          }}
          actions={(person) => {
            const activeAdmin = person.admin.status === "active"
            return (
              <RowActions>
                {person.profile.telegramUsername ? (
                  <IconButton
                    label="Open in Telegram"
                    ariaLabel={`Open ${personName(person)} in Telegram`}
                    icon={Send}
                    iconNode={<PlatformGlyph platform="tg" className="size-4" />}
                    nativeButton={false}
                    render={<a href={telegramUrl(person.profile.telegramUsername)} target="_blank" rel="noreferrer" />}
                  />
                ) : (
                  <span aria-hidden className="size-9 max-shell:hidden" />
                )}
                <ActionMenu
                  label={`More actions for ${personName(person)}`}
                  actions={[
                    canWrite &&
                      activeAdmin &&
                      !person.admin.capoScope && {
                        label: "Capo Admin of reference",
                        ariaLabel: `Capo Admin of reference for ${personName(person)}`,
                        icon: UserRoundCog,
                        onClick: () => open("capoRef", person),
                      },
                    canAppoint &&
                      activeAdmin && {
                        label: person.admin.capoScope ? "Change Capo Admin scope" : "Appoint as Capo Admin",
                        ariaLabel: `${person.admin.capoScope ? "Change Capo Admin scope of" : "Appoint as Capo Admin"} ${personName(person)}`,
                        icon: Crown,
                        onClick: () => open("capoScope", person),
                      },
                    canAppoint &&
                      activeAdmin &&
                      person.admin.capoScope !== null && {
                        label: "End Capo Admin role",
                        ariaLabel: `End the Capo Admin role of ${personName(person)}`,
                        icon: Crown,
                        destructive: true,
                        onClick: () => open("endCapo", person),
                      },
                    canWrite &&
                      activeAdmin &&
                      (canAppoint || person.admin.capoScope === null) && {
                        label: "End admin role",
                        ariaLabel: `End the admin role of ${personName(person)}`,
                        icon: UserMinus,
                        destructive: true,
                        onClick: () => open("end", person),
                      },
                  ]}
                />
              </RowActions>
            )
          }}
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
                icon={ShieldUser}
                title="No admins match"
                text="Try another search or remove a filter."
                action={
                  <Button size="sm" variant="ghost" className={buttonMotion} onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : scope === "former" ? (
              <EmptyState icon={ShieldUser} title="No former admins" text="Admins whose role ended appear here." />
            ) : (
              <EmptyState
                icon={ShieldUser}
                title="No admins yet"
                text="Admins appear here when you add a person as admin."
              />
            )
          }
        />
      </PageContent>
      {dialog && target ? (
        dialog.kind === "end" ? (
          <EndAdminDialog key={`end-${dialogKey}`} open={dialogOpen} onOpenChange={setDialogOpen} target={target} />
        ) : dialog.kind === "capoRef" ? (
          <CapoOfReferenceDialog
            key={`ref-${dialogKey}`}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            target={target}
            current={dialog.admin.admin.capoOfReference?.id ?? null}
            people={people}
          />
        ) : dialog.kind === "capoScope" ? (
          <CapoScopeDialog
            key={`scope-${dialogKey}`}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            target={target}
            scope={dialog.admin.admin.capoScope}
          />
        ) : (
          <EndCapoDialog
            key={`end-capo-${dialogKey}`}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            target={target}
            scope={dialog.admin.admin.capoScope ?? ""}
          />
        )
      ) : null}
    </>
  )
}
