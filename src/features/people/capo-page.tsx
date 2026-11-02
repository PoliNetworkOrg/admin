import { Send, ShieldUser } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  PlatformGlyph,
  RowActions,
  SectionHeading,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import { currentAdmin, formatDay, personName, telegramUrl } from "./people-format"
import { AssignmentBadge, PersonCell } from "./people-ui"
import type { CapoArea, PersonRow } from "./people.contract"

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

const columns: DataTableColumn<PersonRow>[] = [
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 220,
    mobile: "main",
    cell: (person) => <PersonCell name={personName(person)} />,
  },
  {
    id: "since",
    label: "Admin since",
    sortable: true,
    width: 136,
    priority: 3,
    mobile: "meta",
    cell: (person) => {
      const admin = currentAdmin(person)
      return admin ? <span className="whitespace-nowrap">{formatDay(admin.since)}</span> : <Unset />
    },
  },
  {
    id: "telegram",
    label: "Telegram",
    width: 200,
    priority: 2,
    mobile: "meta",
    cell: (person) =>
      person.telegramUsername ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <PlatformGlyph platform="tg" className="size-3.5 shrink-0" />
          <span className="truncate font-mono text-[13px]">@{person.telegramUsername}</span>
        </span>
      ) : (
        <Unset />
      ),
  },
  {
    id: "status",
    label: "With Auth",
    width: 184,
    priority: 4,
    mobile: "meta",
    cell: (person) => {
      const admin = currentAdmin(person)
      return admin ? <AssignmentBadge assignment={admin} /> : null
    },
  },
]

/**
 * Telegram › Capo Admin: the admins who have the signed-in Capo Admin as Capo Admin of reference. Read-only for now.
 * Managing them ("a Capo Admin adds and removes their admins", PoliNetworkOrg/admin#143) would add a page action
 * next to the heading and row actions to this table, the way People › Admins has them.
 */
export function CapoPage({ area }: { area: CapoArea }) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const filtered = area.admins.filter(
    (person) =>
      !deferredQuery ||
      [personName(person), person.telegramUsername ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(deferredQuery.replace(/^@/, ""))
      )
  )
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted(
    (a, b) =>
      (sort.column === "since"
        ? (currentAdmin(a)?.since ?? "").localeCompare(currentAdmin(b)?.since ?? "")
        : personName(a).localeCompare(personName(b))) * sign
  )
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      <PageBar description={`Capo Admin of ${area.scope} · ${pluralize(area.admins.length, "admin")}`} />
      <PageContent>
        <section className="flex flex-col gap-3" aria-labelledby="capo-admins">
          <SectionHeading id="capo-admins" title="My admins" count={area.admins.length} />
          <Toolbar
            search={{
              value: query,
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: "Search admins…",
            }}
            count={
              deferredQuery ? (
                <Count value={filtered.length} total={area.admins.length} noun="admin" plural="admins" />
              ) : undefined
            }
          />
          <DataTable
            label="My admins"
            columns={columns}
            rows={rows}
            getRowId={(person) => person.id}
            rowLabel={personName}
            sort={sort}
            onSort={(next) => {
              setSort(next)
              setPage(1)
            }}
            actions={(person) => (
              <RowActions>
                {person.telegramUsername ? (
                  <IconButton
                    label="Open in Telegram"
                    ariaLabel={`Open ${personName(person)} in Telegram`}
                    icon={Send}
                    iconNode={<PlatformGlyph platform="tg" className="size-4" />}
                    nativeButton={false}
                    render={<a href={telegramUrl(person.telegramUsername)} target="_blank" rel="noreferrer" />}
                  />
                ) : (
                  <span aria-hidden className="size-9 max-shell:hidden" />
                )}
              </RowActions>
            )}
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
              deferredQuery ? (
                <EmptyState
                  icon={ShieldUser}
                  title="No admins match"
                  text="Try another name or username."
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ShieldUser}
                  title="No admins yet"
                  text="Admins appear here once HR sets you as their Capo Admin of reference."
                />
              )
            }
          />
        </section>
      </PageContent>
    </>
  )
}
