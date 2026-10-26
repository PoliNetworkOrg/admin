import { MessageCircle, Send, ShieldUser } from "lucide-react"
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

import { formatDay, personName, telegramUrl, whatsappUrl } from "./people-format"
import { PersonCell } from "./people-ui"
import type { CapoArea, PersonRow } from "./people.contract"

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

/** Telegram › Capo Admin: the admins who have the signed-in Capo Admin as Capo of reference. */
export function CapoPage({ area }: { area: CapoArea }) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const filtered = area.admins.filter(
    (person) =>
      !deferredQuery ||
      [personName(person), person.profile.telegramUsername ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(deferredQuery)
      )
  )
  const sign = sort.direction === "asc" ? 1 : -1
  const sorted = filtered.toSorted((a, b) => personName(a).localeCompare(personName(b)) * sign)
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)

  const columns: DataTableColumn<PersonRow>[] = [
    {
      id: "name",
      label: "Name",
      sortable: true,
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (person) => <PersonCell name={personName(person)} secondary={person.profile.course} />,
    },
    {
      id: "year",
      label: "Year",
      width: 112,
      priority: 3,
      mobile: "hidden",
      cell: (person) =>
        person.profile.year ? <span className="whitespace-nowrap">{person.profile.year}</span> : <Unset />,
    },
    {
      id: "since",
      label: "Active since",
      width: 128,
      priority: 4,
      mobile: "hidden",
      cell: (person) =>
        person.admin ? <span className="whitespace-nowrap">{formatDay(person.admin.since)}</span> : <Unset />,
    },
    {
      id: "representative",
      label: "Representative",
      width: 168,
      priority: 5,
      mobile: "hidden",
      cell: (person) =>
        person.profile.studentRepresentative ? (
          <span className="block truncate">{person.profile.studentRepresentative}</span>
        ) : (
          <Unset />
        ),
    },
    {
      id: "phone",
      label: "Phone",
      width: 152,
      mobile: "meta",
      cell: (person) =>
        person.profile.phone ? <span className="whitespace-nowrap">{person.profile.phone}</span> : <Unset />,
    },
    {
      id: "telegram",
      label: "Telegram",
      width: 176,
      priority: 3,
      mobile: "meta",
      cell: (person) =>
        person.profile.telegramUsername ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <PlatformGlyph platform="tg" className="size-3.5 shrink-0" />
            <span className="truncate font-mono text-[13px]">@{person.profile.telegramUsername}</span>
          </span>
        ) : (
          <Unset />
        ),
    },
  ]

  return (
    <>
      <PageBar description={`${area.scope} · ${pluralize(area.admins.length, "admin")}`} />
      <PageContent>
        <div className="flex flex-col gap-8">
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
                  {person.profile.telegramUsername ? (
                    <IconButton
                      label="Open in Telegram"
                      ariaLabel={`Open ${personName(person)} in Telegram`}
                      icon={Send}
                      iconNode={<PlatformGlyph platform="tg" className="size-4" />}
                      nativeButton={false}
                      render={
                        <a href={telegramUrl(person.profile.telegramUsername)} target="_blank" rel="noreferrer" />
                      }
                    />
                  ) : (
                    <span aria-hidden className="size-9 max-shell:hidden" />
                  )}
                  {person.profile.phone ? (
                    <IconButton
                      label="Open in WhatsApp"
                      ariaLabel={`Open ${personName(person)} in WhatsApp`}
                      icon={MessageCircle}
                      iconNode={<PlatformGlyph platform="wa" className="size-4" />}
                      nativeButton={false}
                      render={<a href={whatsappUrl(person.profile.phone)} target="_blank" rel="noreferrer" />}
                    />
                  ) : null}
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
                    text="Admins appear here once you are set as their Capo of reference."
                  />
                )
              }
            />
          </section>
        </div>
      </PageContent>
    </>
  )
}
