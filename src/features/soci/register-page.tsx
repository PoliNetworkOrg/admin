import { useServerFn } from "@tanstack/react-start"
import { IdCard, Pencil, Plus } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  InlineAlert,
  Unset,
  SegmentedControl,
  type TableSort,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDay } from "@/features/people/people-format"
import { errorMessage, useDialog, useDialogState } from "@/features/people/people-hooks"
import { MonoChip, PersonCell, StateBadge } from "@/features/people/people-ui"
import { pluralize } from "@/lib/format"

import { END_REASON, FEE_STATUS, formatMemberNumber, MISMATCH, socioName, socioStatus } from "./soci-format"
import type { FEE_STATUSES, SociList, SocioRecord, SocioRow, Unregistered } from "./soci.contract"
import { getSocio } from "./soci.functions"
import { AdmitSocioDialog, EditSocioDialog, RegisterSocioDialog } from "./socio-dialogs"

type Scope = "active" | "ended" | "all"
/** This year's fee, or `none` when no fee has been opened for the socio. */
type FeeFilter = (typeof FEE_STATUSES)[number] | "none"

const FEE_FILTERS = ["due", "uploaded", "paid", "exempt", "none"] as const satisfies readonly FeeFilter[]

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
    socio.codiceFiscale ?? "",
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
          {socio.fee ? (
            <StateBadge
              state={{ ...FEE_STATUS[socio.fee], label: `Fee ${FEE_STATUS[socio.fee].label.toLowerCase()}` }}
            />
          ) : null}
        </span>
      </>
    ),
  },
  {
    id: "mailbox",
    label: "Mailbox",
    width: 232,
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
    id: "fee",
    label: "This year's fee",
    width: 120,
    priority: 1,
    mobile: "hidden",
    cell: (socio) => (socio.fee ? <StateBadge state={FEE_STATUS[socio.fee]} /> : <Unset />),
  },
  {
    id: "codiceFiscale",
    label: "Codice fiscale",
    width: 140,
    priority: 4,
    mobile: "hidden",
    cell: (socio) =>
      socio.codiceFiscale ? (
        <span className="block truncate font-mono text-[11px] tracking-tight text-(--pn-fg-muted)">
          {socio.codiceFiscale}
        </span>
      ) : (
        <Unset />
      ),
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
  const edit = useDialog<SocioRecord>()
  const loadSocio = useServerFn(getSocio)
  /** The row whose record is loading for Edit. */
  const [loadingEdit, setLoadingEdit] = useState<number | null>(null)
  const [scope, setScope] = useState<Scope>("active")
  const [fee, setFee] = useState<FeeFilter | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const members = register.members
  const active = members.filter((socio) => !socio.endedOn)
  const ended = members.filter((socio) => socio.endedOn)
  const inScope = scope === "all" ? members : scope === "active" ? active : ended
  const feeOf = (socio: SocioRow): FeeFilter => socio.fee ?? "none"
  const withFee = fee === null ? inScope : inScope.filter((socio) => feeOf(socio) === fee)
  const filtered = withFee.filter((socio) => matchesQuery(socio, deferredQuery))
  const sorted = filtered.toSorted((a, b) => compare(a, b, sort))
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const notInSoci = members.filter((socio) => socio.mismatch === "not_in_soci")
  const stillInSoci = members.filter((socio) => socio.mismatch === "still_in_soci")
  const list = (soci: SocioRow[]) =>
    soci.map((socio) => `${formatMemberNumber(socio.number)} ${socioName(socio)}`).join(", ")

  // The row carries only part of the record: Edit loads the rest first.
  async function editSocio(socio: SocioRow) {
    setLoadingEdit(socio.number)
    try {
      edit.show(await loadSocio({ data: { number: socio.number } }))
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, `Couldn't load ${socioName(socio)}. Try again.`))
    } finally {
      setLoadingEdit(null)
    }
  }

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
            filters={
              <FilterMenu<FeeFilter>
                label="Fee"
                allLabel="Any fee"
                options={FEE_FILTERS.map((value) => ({
                  value,
                  label: value === "none" ? "Not open" : FEE_STATUS[value].label,
                  count: inScope.filter((socio) => feeOf(socio) === value).length,
                }))}
                value={fee}
                onChange={(next) => {
                  setFee(next)
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
              deferredQuery || fee !== null ? (
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
            actions={
              canWrite
                ? (socio) => (
                    <IconButton
                      label="Edit"
                      ariaLabel={`Edit ${socioName(socio)}`}
                      icon={Pencil}
                      pending={loadingEdit === socio.number}
                      disabled={loadingEdit !== null}
                      onClick={() => void editSocio(socio)}
                    />
                  )
                : undefined
            }
            actionsWidth={64}
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
              deferredQuery || fee !== null ? (
                <EmptyState
                  icon={IdCard}
                  title="No soci match"
                  text={
                    deferredQuery
                      ? "Try another name, number, mailbox or codice fiscale."
                      : "Choose another fee status or scope."
                  }
                  action={
                    fee !== null ? (
                      <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setFee(null)}>
                        Clear fee filter
                      </Button>
                    ) : undefined
                  }
                />
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
      {canWrite && edit.target ? (
        <EditSocioDialog
          key={`edit-${edit.key}`}
          open={edit.open}
          onOpenChange={edit.onOpenChange}
          socio={edit.target}
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
