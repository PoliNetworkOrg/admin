import { IdCard, Plus } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  InlineAlert,
  SegmentedControl,
  type TableSort,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDay } from "@/features/people/people-format"
import { useDialogState } from "@/features/people/people-hooks"
import { MonoChip, PersonCell, StateBadge } from "@/features/people/people-ui"
import { pluralize } from "@/lib/format"

import { END_REASON, formatMemberNumber, MISMATCH, socioName, socioStatus } from "./soci-format"
import type { SociList, SocioRow, Unregistered } from "./soci.contract"
import { AdmitSocioDialog, RegisterSocioDialog } from "./socio-dialogs"

type Scope = "active" | "ended" | "all"

const SCOPES = [
  { value: "active", label: "Active" },
  { value: "ended", label: "Ended" },
  { value: "all", label: "All" },
] as const

function matchesQuery(socio: SocioRow, query: string) {
  if (!query) return true
  return [
    socioName(socio),
    socio.alias ?? "",
    String(socio.number),
    formatMemberNumber(socio.number),
    socio.mailbox,
  ].some((value) => value.toLocaleLowerCase().includes(query))
}

function compare(a: SocioRow, b: SocioRow, sort: TableSort) {
  const sign = sort.direction === "asc" ? 1 : -1
  if (sort.column === "admitted") return a.admittedOn.localeCompare(b.admittedOn) * sign || a.number - b.number
  if (sort.column === "name") return socioName(a).localeCompare(socioName(b)) * sign
  return (a.number - b.number) * sign
}

const columns: DataTableColumn<SocioRow>[] = [
  {
    id: "number",
    label: "Number",
    sortable: true,
    width: 96,
    mobile: "hidden",
    cell: (socio) => <MonoChip>{formatMemberNumber(socio.number)}</MonoChip>,
  },
  {
    id: "name",
    label: "Name",
    sortable: true,
    fill: true,
    minWidth: 200,
    mobile: "main",
    cell: (socio) => (
      <>
        <PersonCell name={socioName(socio)} secondary={socio.alias} muted={!!socio.endedOn} />
        {/* Mobile cards: the number and status on one line. */}
        <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 max-shell:flex">
          <MonoChip>{formatMemberNumber(socio.number)}</MonoChip>
          <StateBadge state={socioStatus(socio)} />
          {socio.mismatch ? <StateBadge state={{ label: "Mismatch", tone: "warning" }} /> : null}
        </span>
      </>
    ),
  },
  {
    id: "mailbox",
    label: "Mailbox",
    width: 264,
    priority: 3,
    mobile: "hidden",
    cell: (socio) => <span className="block truncate font-mono text-[13px]">{socio.mailbox}</span>,
  },
  {
    id: "admitted",
    label: "Admitted on",
    sortable: true,
    width: 128,
    priority: 2,
    mobile: "hidden",
    cell: (socio) => <span className="whitespace-nowrap">{formatDay(socio.admittedOn)}</span>,
  },
  {
    id: "status",
    label: "Status",
    width: 200,
    mobile: "hidden",
    cell: (socio) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <StateBadge state={socioStatus(socio)} />
          {socio.mismatch ? <StateBadge state={{ label: "Mismatch", tone: "warning" }} /> : null}
        </span>
        {socio.endedOn ? (
          <span className="truncate text-xs text-(--pn-fg-muted)">
            {socio.endReason ? END_REASON[socio.endReason] : "Ended"} · {formatDay(socio.endedOn)}
          </span>
        ) : null}
      </span>
    ),
  },
]

const DEFAULT_SORT: TableSort = { column: "number", direction: "asc" }

/**
 * Soci › Register: the Libro Soci, one record per admission. Alerts above the table list the Soci group's accounts
 * without a record (with Register) and the records that disagree with Soci membership.
 */
export function RegisterPage({ register, unregistered }: { register: SociList; unregistered: Unregistered[] | null }) {
  const canWrite = useCan("soci:write")
  const admit = useDialogState()
  const registerDialog = useDialogState()
  const [scope, setScope] = useState<Scope>("active")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const members = register.members
  const active = members.filter((socio) => !socio.endedOn)
  const ended = members.filter((socio) => socio.endedOn)
  const inScope = scope === "all" ? members : scope === "active" ? active : ended
  const filtered = inScope.filter((socio) => matchesQuery(socio, deferredQuery))
  const sorted = filtered.toSorted((a, b) => compare(a, b, sort))
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const notInSoci = members.filter((socio) => socio.mismatch === "not_in_soci")
  const stillInSoci = members.filter((socio) => socio.mismatch === "still_in_soci")
  const list = (soci: SocioRow[]) =>
    soci.map((socio) => `${formatMemberNumber(socio.number)} ${socioName(socio)}`).join(", ")

  const admitButton = (variant: "default" | "outline") => (
    <Button size="sm" variant={variant} className={buttonMotion} onClick={admit.show}>
      <Plus data-icon="inline-start" />
      Admit socio
    </Button>
  )

  return (
    <>
      <PageBar
        description={`${pluralize(active.length, "active socio")} · ${ended.length} ended`}
        right={canWrite ? admitButton("default") : undefined}
        left={
          <Toolbar
            lead={
              <SegmentedControl<Scope>
                label="Status"
                items={SCOPES.map((item) => ({
                  ...item,
                  count: item.value === "all" ? members.length : item.value === "active" ? active.length : ended.length,
                }))}
                value={scope}
                onValueChange={(next) => {
                  setScope(next)
                  setPage(1)
                }}
              />
            }
            search={{
              value: query,
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
            }}
            count={
              deferredQuery ? (
                <Count value={filtered.length} total={inScope.length} noun="socio" plural="soci" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <div className="flex flex-col gap-4">
          {unregistered === null || !register.directoryAvailable ? (
            <InlineAlert tone="neutral">
              Microsoft 365 couldn't be read: the Soci group's accounts without a record, and mismatches, aren't shown.
            </InlineAlert>
          ) : null}
          {unregistered?.length ? (
            <InlineAlert
              tone="warning"
              action={
                canWrite ? (
                  <Button size="sm" variant="outline" className={buttonMotion} onClick={registerDialog.show}>
                    Register
                  </Button>
                ) : undefined
              }
            >
              {pluralize(unregistered.length, "socio")} in Microsoft 365 {unregistered.length === 1 ? "has" : "have"} no
              record: {unregistered.map((account) => account.displayName ?? account.mail).join(", ")}.
            </InlineAlert>
          ) : null}
          {notInSoci.length ? (
            <InlineAlert tone="warning">
              {MISMATCH.not_in_soci}: {list(notInSoci)}. Check the record, or add the account back to Soci.
            </InlineAlert>
          ) : null}
          {stillInSoci.length ? (
            <InlineAlert tone="warning">
              {MISMATCH.still_in_soci}: {list(stillInSoci)}. Their account still has the Socio role.
            </InlineAlert>
          ) : null}
          <DataTable
            label="Soci"
            columns={columns}
            rows={rows}
            getRowId={(socio) => socio.number}
            rowHref={(socio) => `/dashboard/people/soci/${socio.number}`}
            rowLabel={(socio) => `${formatMemberNumber(socio.number)} ${socioName(socio)}`}
            sort={sort}
            onSort={(next) => {
              setSort(next)
              setPage(1)
            }}
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
                <EmptyState icon={IdCard} title="No soci match" text="Try another name, number or mailbox." />
              ) : (
                <EmptyState
                  icon={IdCard}
                  title={members.length ? `No ${scope} soci` : "The register is empty"}
                  text={
                    members.length
                      ? "Choose another status."
                      : "Admit a new socio, or register the soci already in Microsoft 365."
                  }
                  action={canWrite && !members.length ? admitButton("outline") : undefined}
                />
              )
            }
          />
        </div>
      </PageContent>
      {canWrite ? (
        <AdmitSocioDialog
          key={`admit-${admit.key}`}
          open={admit.open}
          onOpenChange={admit.onOpenChange}
          register={members}
        />
      ) : null}
      {canWrite && unregistered?.length ? (
        <RegisterSocioDialog
          key={`register-${registerDialog.key}`}
          open={registerDialog.open}
          onOpenChange={registerDialog.onOpenChange}
          accounts={unregistered}
          register={members}
        />
      ) : null}
    </>
  )
}
