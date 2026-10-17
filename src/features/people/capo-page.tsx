import { useServerFn } from "@tanstack/react-start"
import { MessageCircle, Send, ShieldUser } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  ChipOverflow,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  PlatformGlyph,
  RowActions,
  SectionCard,
  SectionEmpty,
  SectionHeading,
  StatusBadge,
  type TableSort,
  Unset,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"

import { approveJoinRequest, declineJoinRequest } from "./people-capo.functions"
import { formatDay, personName, telegramUrl, whatsappUrl } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { PersonAvatar, PersonCell, TruncatedChip } from "./people-ui"
import type { CapoArea, PersonRow } from "./people.contract"

type CapoRequest = CapoArea["requests"][number]

const DEFAULT_SORT: TableSort = { column: "name", direction: "asc" }

/** Telegram › Capo Admin: the groups of the signed-in Capo Admin's course, their admins and requests to join. */
export function CapoPage({ area }: { area: CapoArea }) {
  const approve = useServerFn(approveJoinRequest)
  const decline = useServerFn(declineJoinRequest)
  const refresh = useRefreshAfter()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pending, setPending] = useState<string | null>(null)
  const titles = new Set(area.groups.map((group) => group.title))

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

  async function decide(request: CapoRequest, approved: boolean) {
    setPending(request.id)
    try {
      await (approved ? approve : decline)({ data: { requestId: request.id } })
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, approved ? "Couldn't approve the request." : "Couldn't decline the request."))
      setPending(null)
      return
    }
    await refresh(approved ? `${request.person.name} added as admin of ${request.group.title}.` : "Request declined.")
    setPending(null)
  }

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
      cell: (person) => <span className="whitespace-nowrap">{person.profile.year}</span>,
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
      id: "groups",
      label: "Groups",
      width: 200,
      mobile: "full",
      cell: (person) => {
        const groups = person.admin?.groups.filter((group) => titles.has(group.title)) ?? []
        return groups.length ? (
          <ChipOverflow
            items={groups}
            itemLabel={(group) => group.title}
            renderItem={(group) => <TruncatedChip key={group.chatId} label={group.title} />}
          />
        ) : (
          <Unset />
        )
      },
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
      <PageBar description={`${area.scope} · ${pluralize(area.groups.length, "group")}`} />
      <PageContent>
        <div className="flex flex-col gap-8">
          <div className="grid items-start gap-4 min-[1100px]:grid-cols-2">
            <SectionCard title="My groups" count={area.groups.length} padding="flush">
              <ul className="divide-y divide-(--pn-line)">
                {area.groups.map((group) => (
                  <li key={group.chatId} className="flex items-center gap-3 px-4 py-3">
                    <PlatformGlyph platform="tg" className="size-5 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[14px] font-medium">{group.title}</span>
                      <span className="text-xs text-(--pn-fg-muted)">
                        {group.admins ? `${pluralize(group.admins, "admin")} · ` : ""}
                        <span className="font-mono">{group.chatId}</span>
                      </span>
                    </span>
                    {group.admins ? null : <StatusBadge tone="warning">No admins</StatusBadge>}
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Requests to join" count={area.requests.length} padding="flush">
              {area.requests.length === 0 ? (
                <SectionEmpty title="No open requests" />
              ) : (
                <ul className="divide-y divide-(--pn-line)">
                  {area.requests.map((request) => (
                    <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <PersonAvatar name={request.person.name} />
                      {/* At least 160px for the name and date; the buttons wrap under them on phones. */}
                      <span className="flex min-w-40 flex-1 basis-40 flex-col gap-0.5">
                        <span className="truncate text-[14px] font-medium">{request.person.name}</span>
                        <span className="text-xs text-(--pn-fg-muted)">
                          {request.group.title} · asked {formatDay(request.requestedOn)}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className={buttonMotion}
                          disabled={pending !== null}
                          onClick={() => decide(request, false)}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={buttonMotion}
                          disabled={pending !== null}
                          onClick={() => decide(request, true)}
                        >
                          Approve
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <section className="flex flex-col gap-3" aria-labelledby="capo-admins">
            <SectionHeading id="capo-admins" title="Admins of my groups" count={area.admins.length} />
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
              label="Admins of my groups"
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
                    text="Admins appear here when the bot sees them in one of your groups."
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
