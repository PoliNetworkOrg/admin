import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Ban,
  ChevronDown,
  EllipsisVertical,
  FileArchive,
  FileDown,
  Receipt as ReceiptIcon,
  RotateCw,
  Search,
  Upload,
  UserRound,
} from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  InlineAlert,
  LoadingButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  RowActions,
  SegmentedControl,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { formatCents } from "./people-fees"
import { retryReceipt } from "./people-fees.functions"
import { saveFile } from "./people-files"
import { formatDay, RECEIPT_STATUS, SIGNER_LABEL } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { downloadReceipt, downloadReceiptsToSign } from "./people-receipts.functions"
import { MonoChip, PersonCell, StateBadge } from "./people-ui"
import {
  RECEIPT_STATUSES,
  type Receipt,
  type ReceiptsPage as ReceiptsData,
  type ReceiptStatus,
} from "./people.contract"
import { UploadSignedDialog, VoidReceiptDialog } from "./receipt-dialogs"

type Scope = "all" | ReceiptStatus

function matchesQuery(receipt: Receipt, query: string) {
  if (!query) return true
  return [receipt.number, receipt.person.name, receipt.memberNumber].some((value) =>
    value.toLocaleLowerCase().includes(query)
  )
}

/** People › Receipts: the fee year's receipts as a queue, To sign → Signed → Sent, with Send failed and Voided. */
export function ReceiptsPage({ page, onYear }: { page: ReceiptsData; onYear: (year: string) => void }) {
  const canSign = useCan("people:receipts:sign") && page.viewerSigner !== null
  const canFees = useCan("people:fees:write")
  const download = useServerFn(downloadReceipt)
  const downloadToSign = useServerFn(downloadReceiptsToSign)
  const retry = useServerFn(retryReceipt)
  const refresh = useRefreshAfter()

  const mine = page.receipts.filter((receipt) => receipt.status === "toSign" && receipt.signer === page.viewerSigner)
  // Receipts waiting for the other officer: the President's own, for the Vice-president.
  const others = page.receipts.filter((receipt) => receipt.status === "toSign" && receipt.signer !== page.viewerSigner)
  const failed = page.receipts.filter((receipt) => receipt.status === "failed")
  const byStatus = (status: ReceiptStatus) => page.receipts.filter((receipt) => receipt.status === status).length

  const [scope, setScope] = useState<Scope>(canSign && mine.length > 0 ? "toSign" : "all")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [pageNumber, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadKey, setUploadKey] = useState(0)
  const [voiding, setVoiding] = useState<Receipt | null>(null)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidKey, setVoidKey] = useState(0)
  const [zipping, setZipping] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const inScope = scope === "all" ? page.receipts : page.receipts.filter((receipt) => receipt.status === scope)
  const filtered = inScope.filter((receipt) => matchesQuery(receipt, deferredQuery))
  const rows = filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
  const narrowed = deferredQuery !== ""

  const signerName = (receipt: Receipt) => {
    if (receipt.signer === page.viewerSigner) return "You"
    const officer = receipt.signer === "president" ? page.officers.president : page.officers.vicePresident
    return officer?.name ?? SIGNER_LABEL[receipt.signer]
  }

  async function save(receipt: Receipt) {
    setBusy(receipt.id)
    try {
      saveFile(await download({ data: { receiptId: receipt.id } }))
    } catch (caught) {
      console.error(caught)
      appToast.error(`Couldn't download receipt ${receipt.number}.`)
    } finally {
      setBusy(null)
    }
  }

  async function saveToSign() {
    setZipping(true)
    try {
      saveFile(await downloadToSign())
      appToast.success(`${pluralize(mine.length, "receipt")} downloaded. Sign them, then upload the signed files.`)
    } catch (caught) {
      console.error(caught)
      appToast.error(
        caught instanceof Error
          ? errorMessage(caught, "Couldn't download the receipts to sign.")
          : "Couldn't download the receipts to sign."
      )
    } finally {
      setZipping(false)
    }
  }

  async function resend(receipt: Receipt) {
    setBusy(receipt.id)
    try {
      await retry({ data: { receiptId: receipt.id } })
    } catch (caught) {
      console.error(caught)
      appToast.error(
        caught instanceof Error
          ? errorMessage(caught, `Couldn't send receipt ${receipt.number}.`)
          : `Couldn't send receipt ${receipt.number}.`
      )
      setBusy(null)
      return
    }
    setBusy(null)
    await refresh(`Receipt ${receipt.number} sent to ${receipt.person.name}.`)
  }

  function openVoid(receipt: Receipt) {
    setVoiding(receipt)
    setVoidKey((value) => value + 1)
    setVoidOpen(true)
  }

  const columns: DataTableColumn<Receipt>[] = [
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
          <PersonCell name={receipt.person.name} muted={receipt.status === "voided"} />
          {/* Mobile cards: number, status, amount and signer on one labelled line. */}
          <span className="mt-2 hidden flex-wrap items-center gap-1.5 pl-11 text-xs text-(--pn-fg-muted) max-shell:flex">
            <MonoChip>{receipt.number}</MonoChip>
            <StateBadge state={RECEIPT_STATUS[receipt.status]} />
            <span className="tabular-nums">{formatCents(receipt.amountCents)}</span>
            {receipt.status === "toSign" && receipt.signer !== page.viewerSigner ? (
              <span>
                Signed by {signerName(receipt)} <Chip>{SIGNER_LABEL[receipt.signer]}</Chip>
              </span>
            ) : null}
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
            <span className="truncate">{receipt.signedBy ?? signerName(receipt)}</span>
            {receipt.signer === "vicePresident" ? <Chip>{SIGNER_LABEL.vicePresident}</Chip> : null}
          </span>
        ),
    },
    {
      id: "status",
      label: "Status",
      width: 136,
      mobile: "hidden",
      cell: (receipt) => <StateBadge state={RECEIPT_STATUS[receipt.status]} />,
    },
  ]

  const scopeEmpty = {
    all: {
      title: "No receipts yet",
      text: "Receipts appear here when an admin approves a transfer receipt or marks a fee as paid.",
    },
    toSign: { title: "No receipts to sign", text: "New receipts wait here for the President's signature." },
    signed: {
      title: "No receipts waiting to be emailed",
      text: "Signed receipts are emailed to the member right away.",
    },
    sent: { title: "No receipts sent yet", text: "Receipts appear here once they're signed and emailed." },
    failed: { title: "No failed emails", text: "When a receipt can't be emailed, it waits here for a retry." },
    voided: { title: "No voided receipts", text: "Voided receipts keep their number and stay here." },
  } satisfies Record<Scope, { title: string; text: string }>

  return (
    <>
      <PageBar
        description={
          <>
            Fee receipts for <span className="font-mono">{page.year}</span>, numbered in issue order
          </>
        }
        right={
          canSign ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className={buttonMotion}
                onClick={() => {
                  setUploadKey((value) => value + 1)
                  setUploadOpen(true)
                }}
              >
                <Upload data-icon="inline-start" />
                Upload signed
              </Button>
              {mine.length > 0 ? (
                <LoadingButton size="sm" icon={FileArchive} pending={zipping} onClick={() => void saveToSign()}>
                  Download to sign ({mine.length})
                </LoadingButton>
              ) : null}
            </>
          ) : undefined
        }
        left={
          <Toolbar
            lead={
              page.years.length > 1 ? (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        variant="outline"
                        className={cn(
                          buttonMotion,
                          "h-10 shrink-0 gap-1.5 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) px-3 text-[14px] font-medium"
                        )}
                      />
                    }
                  >
                    <span>Fee year</span>
                    <span className="font-mono">{page.year}</span>
                    <ChevronDown aria-hidden strokeWidth={1.75} className="size-4 text-(--pn-fg-muted)" />
                  </MenuTrigger>
                  <MenuContent align="start" className="min-w-44">
                    <MenuRadioGroup value={page.year} onValueChange={(next: string) => onYear(next)}>
                      {page.years.map((year) => (
                        <MenuRadioItem key={year} value={year}>
                          <span className="font-mono">{year}</span>
                        </MenuRadioItem>
                      ))}
                    </MenuRadioGroup>
                  </MenuContent>
                </Menu>
              ) : undefined
            }
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
                  { value: "all", label: "All", count: page.receipts.length },
                  ...RECEIPT_STATUSES.map((status) => ({
                    value: status,
                    label: RECEIPT_STATUS[status].label,
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
          {canSign && mine.length > 0 ? (
            <InlineAlert tone="info">
              <span className="font-medium">
                {mine.length === 1 ? "1 receipt is" : `${mine.length} receipts are`} waiting for your signature.
              </span>{" "}
              Download them, sign each PDF with the CIE app, then upload the signed files.
              {others.length > 0
                ? ` ${others.length === 1 ? `Receipt ${others[0]?.number}` : `${others.length} receipts`} ${others.length === 1 ? "is" : "are"} for ${others.length === 1 ? (others[0]?.signer === "vicePresident" ? "the Vice-president" : "the President") : "the other officer"} to sign.`
                : ""}
            </InlineAlert>
          ) : null}
          {canFees && failed.length > 0 && scope !== "failed" ? (
            <InlineAlert
              tone="danger"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className={buttonMotion}
                  onClick={() => {
                    setScope("failed")
                    setPage(1)
                  }}
                >
                  Show
                </Button>
              }
            >
              {failed.length === 1
                ? "1 receipt couldn't be emailed."
                : `${failed.length} receipts couldn't be emailed.`}{" "}
              Check the member's address, then retry.
            </InlineAlert>
          ) : null}
          <DataTable
            label="Receipts"
            columns={columns}
            rows={rows}
            getRowId={(receipt) => receipt.id}
            rowLabel={(receipt) => `${receipt.number}, ${receipt.person.name}`}
            rowHref={(receipt) => `/dashboard/people/${receipt.person.id}`}
            rowProps={(receipt) => ({
              className: receipt.status === "voided" ? "text-(--pn-fg-muted)" : undefined,
            })}
            actions={(receipt) => (
              <RowActions>
                {canFees ? (
                  receipt.status === "failed" ? (
                    <IconButton
                      label="Retry sending"
                      ariaLabel={`Retry sending ${receipt.number}`}
                      icon={RotateCw}
                      disabled={busy === receipt.id}
                      onClick={() => void resend(receipt)}
                    />
                  ) : (
                    <span aria-hidden className="size-9 shrink-0" />
                  )
                ) : null}
                <IconButton
                  label="Download PDF"
                  ariaLabel={`Download ${receipt.number}`}
                  icon={FileDown}
                  disabled={busy === receipt.id}
                  onClick={() => void save(receipt)}
                />
                {canFees ? (
                  <Menu>
                    <MenuTrigger
                      render={
                        <IconButton
                          label="More actions"
                          ariaLabel={`More actions for ${receipt.number}`}
                          icon={EllipsisVertical}
                        />
                      }
                    />
                    <MenuContent>
                      <MenuItem
                        render={<Link to="/dashboard/people/$personId" params={{ personId: receipt.person.id }} />}
                      >
                        <UserRound />
                        Open record
                      </MenuItem>
                      {receipt.status !== "voided" ? (
                        <>
                          <MenuSeparator />
                          <MenuItem variant="destructive" onClick={() => openVoid(receipt)}>
                            <Ban />
                            Void receipt
                          </MenuItem>
                        </>
                      ) : null}
                    </MenuContent>
                  </Menu>
                ) : null}
              </RowActions>
            )}
            actionsWidth={canFees ? 132 : 60}
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
                  text={`No receipt in ${page.year} has that number or member name.`}
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon={ReceiptIcon} title={scopeEmpty[scope].title} text={scopeEmpty[scope].text} />
              )
            }
          />
        </div>
      </PageContent>
      {canSign ? (
        <UploadSignedDialog key={`upload-${uploadKey}`} open={uploadOpen} onOpenChange={setUploadOpen} page={page} />
      ) : null}
      {canFees && voiding ? (
        <VoidReceiptDialog key={`void-${voidKey}`} open={voidOpen} onOpenChange={setVoidOpen} receipt={voiding} />
      ) : null}
    </>
  )
}
