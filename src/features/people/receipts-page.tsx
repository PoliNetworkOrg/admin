import { Ban, FileArchive, FileDown, Receipt as ReceiptIcon, RotateCw, Search, Upload } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  RowActions,
  SegmentedControl,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { MockupBanner } from "./mockup-banner"
import {
  formatCents,
  MOCK_FEE_YEAR,
  MOCK_RECEIPT_STATUS,
  MOCK_RECEIPT_STATUSES,
  MOCK_RECEIPTS,
  MOCK_SIGNER_LABEL,
  type MockReceipt,
  type MockReceiptStatus,
} from "./mockup-data"
import { formatDay } from "./people-format"
import { MonoChip, PersonCell, StateBadge } from "./people-ui"

type Scope = "all" | MockReceiptStatus

function matchesQuery(receipt: MockReceipt, query: string) {
  if (!query) return true
  return [receipt.number, receipt.name, receipt.memberNumber].some((value) => value.toLocaleLowerCase().includes(query))
}

const columns: DataTableColumn<MockReceipt>[] = [
  {
    id: "number",
    label: "Receipt",
    width: 116,
    mobile: "hidden",
    cell: (receipt) => (
      <span className={cn(receipt.status === "voided" && "line-through")}>
        <MonoChip>{receipt.number}</MonoChip>
      </span>
    ),
  },
  {
    id: "member",
    label: "Member",
    fill: true,
    minWidth: 200,
    mobile: "main",
    cell: (receipt) => (
      <>
        <PersonCell name={receipt.name} muted={receipt.status === "voided"} />
        {/* Mobile cards: number, status and amount on one labelled line. */}
        <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 text-xs text-(--pn-fg-muted) max-shell:flex">
          <MonoChip>{receipt.number}</MonoChip>
          <StateBadge state={MOCK_RECEIPT_STATUS[receipt.status]} />
          <span className="tabular-nums">{formatCents(receipt.amountCents)}</span>
        </span>
      </>
    ),
  },
  {
    id: "amount",
    label: "Amount",
    width: 96,
    align: "end",
    priority: 3,
    mobile: "hidden",
    cell: (receipt) => <span className="tabular-nums">{formatCents(receipt.amountCents)}</span>,
  },
  {
    id: "issued",
    label: "Issued on",
    width: 124,
    priority: 2,
    mobile: "hidden",
    cell: (receipt) => <span className="whitespace-nowrap tabular-nums">{formatDay(receipt.issuedOn)}</span>,
  },
  {
    id: "signer",
    label: "Signer",
    width: 248,
    priority: 4,
    mobile: "hidden",
    cell: (receipt) =>
      receipt.status === "voided" ? null : (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{receipt.signedBy ?? MOCK_SIGNER_LABEL[receipt.signer]}</span>
          {receipt.signer === "vicePresident" ? <Chip>{MOCK_SIGNER_LABEL.vicePresident}</Chip> : null}
        </span>
      ),
  },
  {
    id: "status",
    label: "Status",
    width: 136,
    mobile: "hidden",
    cell: (receipt) => <StateBadge state={MOCK_RECEIPT_STATUS[receipt.status]} />,
  },
]

const SCOPE_EMPTY = {
  all: { title: "No receipts yet", text: "The mockup has no sample receipts." },
  toSign: { title: "No receipts to sign", text: "New receipts wait here for the President's signature." },
  signed: { title: "No receipts waiting to be emailed", text: "Signed receipts are emailed to the member right away." },
  sent: { title: "No receipts sent yet", text: "Receipts appear here once they're signed and emailed." },
  failed: { title: "No failed emails", text: "When a receipt can't be emailed, it waits here for a retry." },
  voided: { title: "No voided receipts", text: "Voided receipts keep their number and stay here." },
} satisfies Record<Scope, { title: string; text: string }>

/**
 * People › Receipts: an unconnected mockup of one fee year's receipts, To sign → Signed → Sent, kept to be reworked in
 * Phase 2 (#144). It reads nothing from the backend and every action is disabled.
 */
export function ReceiptsPage() {
  const receipts = MOCK_RECEIPTS
  const [scope, setScope] = useState<Scope>("all")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [pageNumber, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const byStatus = (status: MockReceiptStatus) => receipts.filter((receipt) => receipt.status === status).length
  const inScope = scope === "all" ? receipts : receipts.filter((receipt) => receipt.status === scope)
  const filtered = inScope.filter((receipt) => matchesQuery(receipt, deferredQuery))
  const rows = filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
  const narrowed = deferredQuery !== ""

  return (
    <>
      <PageBar
        description={
          <>
            Fee year <span className="font-mono">{MOCK_FEE_YEAR}</span>
          </>
        }
        right={
          <>
            <Button size="sm" className={buttonMotion} disabled>
              <FileArchive data-icon="inline-start" />
              Download to sign ({byStatus("toSign")})
            </Button>
            <IconButton label="Upload signed" icon={Upload} appearance="boxed" className="size-10" disabled />
          </>
        }
        left={
          <Toolbar
            search={{
              value: query,
              onChange: (value) => {
                setQuery(value)
                setPage(1)
              },
              placeholder: "Search by name or receipt number…",
            }}
            filters={
              <SegmentedControl<Scope>
                label="Receipt status"
                items={[
                  { value: "all", label: "All", count: receipts.length },
                  ...MOCK_RECEIPT_STATUSES.map((status) => ({
                    value: status,
                    label: MOCK_RECEIPT_STATUS[status].label,
                    count: byStatus(status),
                  })),
                ]}
                value={scope}
                onValueChange={(next) => {
                  setScope(next)
                  setPage(1)
                }}
              />
            }
            count={
              narrowed ? (
                <Count value={filtered.length} total={inScope.length} noun="receipt" plural="receipts" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <div className="flex flex-col gap-4">
          <MockupBanner phase={2} />
          <DataTable
            label="Receipts (mockup)"
            columns={columns}
            rows={rows}
            getRowId={(receipt) => receipt.id}
            rowLabel={(receipt) => `${receipt.number}, ${receipt.name}`}
            rowProps={(receipt) => ({
              className: receipt.status === "voided" ? "text-(--pn-fg-muted)" : undefined,
            })}
            actions={(receipt) => (
              <RowActions>
                {receipt.status === "failed" ? (
                  <IconButton
                    label="Retry sending"
                    ariaLabel={`Retry sending ${receipt.number}`}
                    icon={RotateCw}
                    disabled
                  />
                ) : (
                  <span aria-hidden className="size-9 shrink-0" />
                )}
                <IconButton label="Download PDF" ariaLabel={`Download ${receipt.number}`} icon={FileDown} disabled />
                <IconButton
                  label="Void receipt"
                  ariaLabel={`Void receipt ${receipt.number}`}
                  icon={Ban}
                  tone="danger"
                  disabled
                />
              </RowActions>
            )}
            actionsWidth={132}
            pagination={{
              page: pageNumber,
              pageSize,
              total: filtered.length,
              onPage: setPage,
              onPageSize: (size) => {
                setPageSize(size)
                setPage(1)
              },
            }}
            empty={
              narrowed ? (
                <EmptyState
                  icon={Search}
                  title="No receipts match"
                  text={`No receipt in ${MOCK_FEE_YEAR} has that number or member name.`}
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon={ReceiptIcon} title={SCOPE_EMPTY[scope].title} text={SCOPE_EMPTY[scope].text} />
              )
            }
          />
        </div>
      </PageContent>
    </>
  )
}
