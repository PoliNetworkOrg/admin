import { useNavigate } from "@tanstack/react-router"
import { BadgeCheck, FileSearch, Receipt, Search } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  SegmentedControl,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDay, todayIso } from "@/features/people/people-format"
import { useDialog } from "@/features/people/people-hooks"
import { MonoChip, PersonCell } from "@/features/people/people-ui"

import { MarkPaidDialog, ReviewFeeDialog } from "./fee-dialogs"
import { amountMismatch, FeeBadge, feeSummary } from "./fee-ui"
import { feeYearLabel, pastDeadline, renewalDeadline } from "./soci-fees"
import { FEE_STATUS, formatMemberNumber, socioName } from "./soci-format"
import type { FEE_STATUSES, FeesList } from "./soci.contract"

type Status = (typeof FEE_STATUSES)[number]
type FeeRow = FeesList["fees"][number]

/** Segments in the order fees are worked off: receipts to review first. */
const SEGMENTS = ["uploaded", "due", "paid", "exempt"] as const satisfies readonly Status[]

const EMPTY = {
  uploaded: { title: "No receipts to review", text: "Transfer receipts soci upload in My area wait here." },
  due: { title: "Nobody owes this fee", text: "Every socio with a fee this year has paid, or is exempt." },
  paid: { title: "No fees paid yet", text: "Confirmed receipts and payments marked by hand show here." },
  exempt: { title: "Nobody is exempt", text: "Soci admitted from 1 June to 31 August are exempt from the next year." },
} satisfies Record<Status, { title: string; text: string }>

function matchesQuery(row: FeeRow, query: string) {
  if (!query) return true
  return [socioName(row), row.alias ?? "", String(row.number), formatMemberNumber(row.number), row.mailbox].some(
    (value) => value.toLocaleLowerCase().includes(query)
  )
}

const columns: DataTableColumn<FeeRow>[] = [
  {
    id: "number",
    label: "Number",
    width: 96,
    mobile: "hidden",
    cell: (row) => <MonoChip>{formatMemberNumber(row.number)}</MonoChip>,
  },
  {
    id: "name",
    label: "Name",
    fill: true,
    minWidth: 200,
    mobile: "main",
    cell: (row) => (
      <>
        <PersonCell name={socioName(row)} secondary={row.alias} muted={!!row.endedOn} />
        {/* Mobile cards: the number and the fee on one line, then what happened to it. */}
        <span className="mt-2 hidden flex-col gap-1.5 pl-11 max-shell:flex">
          <span className="flex flex-wrap items-center gap-1.5">
            <MonoChip>{formatMemberNumber(row.number)}</MonoChip>
            <FeeBadge status={row.fee.status} />
          </span>
          <span className="text-xs text-(--pn-fg-muted)">{feeSummary(row.fee)}</span>
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
    cell: (row) => <span className="block truncate font-mono text-[13px]">{row.mailbox}</span>,
  },
  {
    id: "status",
    label: "Status",
    width: 112,
    mobile: "hidden",
    cell: (row) => <FeeBadge status={row.fee.status} />,
  },
  {
    id: "detail",
    label: "Details",
    width: 320,
    priority: 1,
    mobile: "hidden",
    cell: (row) => (
      <span
        className={
          amountMismatch(row.fee) && row.fee.status === "uploaded"
            ? "block truncate text-[13px] text-(--pn-warning-fg)"
            : "block truncate text-[13px] text-(--pn-fg-muted)"
        }
        title={feeSummary(row.fee)}
      >
        {feeSummary(row.fee)}
      </span>
    ),
  },
]

/**
 * Soci › Fees: one fee year's fees as a queue, receipts to review first. The fee-year menu picks the year; segments
 * split it by status, with totals. Review confirms or rejects an uploaded receipt; Mark as paid records a payment made
 * outside the dashboard.
 */
export function FeesPage({ fees, years }: { fees: FeesList; years: readonly number[] }) {
  const canWrite = useCan("soci:write")
  const navigate = useNavigate()
  const review = useDialog<FeeRow>()
  const markPaid = useDialog<FeeRow>()
  const [status, setStatus] = useState<Status>("uploaded")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const inStatus = fees.fees.filter((row) => row.fee.status === status)
  const filtered = inStatus.filter((row) => matchesQuery(row, deferredQuery))
  // A confirmed or rejected receipt leaves the queue: stay on the last page that still has rows.
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const late = pastDeadline(fees.year, todayIso())
  const yearOptions = (years.includes(fees.year) ? years : [fees.year, ...years]).map((year) => ({
    value: String(year),
    label: feeYearLabel(year),
  }))

  return (
    <>
      <PageBar
        description={
          <>
            Fee year <span className="font-mono">{fees.label}</span> · {late ? "renewals closed" : "renew by"}{" "}
            {formatDay(renewalDeadline(fees.year))}
          </>
        }
        left={
          <Toolbar
            lead={
              <SegmentedControl<Status>
                label="Fee status"
                items={SEGMENTS.map((value) => ({ value, label: FEE_STATUS[value].label, count: fees.totals[value] }))}
                value={status}
                onValueChange={(next) => {
                  setStatus(next)
                  setPage(1)
                }}
              />
            }
            filters={
              <FilterMenu
                label="Year"
                mono
                options={yearOptions}
                value={String(fees.year)}
                onChange={(year) => {
                  setPage(1)
                  void navigate({ to: "/dashboard/people/fees", search: { year: Number(year) } })
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
                <Count value={filtered.length} total={inStatus.length} noun="fee" plural="fees" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <DataTable
          label={`Fees ${fees.label}`}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.number}
          rowHref={(row) => `/dashboard/people/soci/${row.number}`}
          rowLabel={(row) => `${formatMemberNumber(row.number)} ${socioName(row)}`}
          actions={
            canWrite
              ? (row) =>
                  row.fee.status === "uploaded" || row.fee.status === "due" ? (
                    <>
                      {row.fee.status === "uploaded" ? (
                        <IconButton
                          label="Review"
                          ariaLabel={`Review ${socioName(row)}'s receipt`}
                          icon={FileSearch}
                          onClick={() => review.show(row)}
                        />
                      ) : (
                        <span aria-hidden className="size-9 shrink-0 max-shell:hidden" />
                      )}
                      <IconButton
                        label="Mark as paid"
                        ariaLabel={`Mark ${socioName(row)}'s fee as paid`}
                        icon={BadgeCheck}
                        onClick={() => markPaid.show(row)}
                      />
                    </>
                  ) : null
              : undefined
          }
          actionsWidth={96}
          pagination={{
            page: currentPage,
            pageSize,
            total: filtered.length,
            onPage: setPage,
            onPageSize: (size) => {
              setPageSize(size)
              setPage(1)
            },
          }}
          empty={
            deferredQuery ? (
              <EmptyState
                icon={Search}
                title="No soci match"
                text="Try another name, number or mailbox."
                action={
                  <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Receipt} title={EMPTY[status].title} text={EMPTY[status].text} />
            )
          }
        />
      </PageContent>
      {canWrite && review.target ? (
        <ReviewFeeDialog
          key={`review-${review.key}`}
          open={review.open}
          onOpenChange={review.onOpenChange}
          socio={review.target}
          fee={review.target.fee}
        />
      ) : null}
      {canWrite && markPaid.target ? (
        <MarkPaidDialog
          key={`paid-${markPaid.key}`}
          open={markPaid.open}
          onOpenChange={markPaid.onOpenChange}
          socio={markPaid.target}
          years={[fees.year]}
          fee={markPaid.target.fee}
        />
      ) : null}
    </>
  )
}
