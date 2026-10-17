import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Ban, FileArchive, FileDown, Receipt as ReceiptIcon, RotateCw, Search, Upload } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FilterMenu,
  IconButton,
  InlineAlert,
  LoadingButton,
  RowActions,
  SegmentedControl,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { SignWithCie } from "@/features/esign/sign-with-cie"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { formatCents } from "./people-fees"
import { retryReceipt } from "./people-fees.functions"
import { formatDay, RECEIPT_STATUS, SIGNER_LABEL } from "./people-format"
import { errorMessage, useFileDownload, useRefreshAfter } from "./people-hooks"
import { downloadReceipt, downloadReceiptsToSign, prepareReceiptSignatures } from "./people-receipts.functions"
import { ActionMenu, MonoChip, PersonCell, StateBadge } from "./people-ui"
import {
  RECEIPT_SIGN_BATCH,
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

/** The receipts waiting for the other officer, after the viewer's own: the President's own goes to the Vice-president. */
function othersNote(others: readonly Receipt[]) {
  const [first] = others
  if (!first) return ""
  if (others.length > 1) return ` ${others.length} receipts are for the other officer to sign.`
  return ` Receipt ${first.number} is for the ${SIGNER_LABEL[first.signer]} to sign.`
}

/** People › Receipts: the fee year's receipts as a queue, To sign → Signed → Sent, with Send failed and Voided. */
export function ReceiptsPage({ page, onYear }: { page: ReceiptsData; onYear: (year: string) => void }) {
  const canSign = useCan("people:receipts:sign") && page.viewerSigner !== null
  const canEsign = useCan("esign:sign")
  const canWebSign = canSign && canEsign
  const router = useRouter()
  const prepareSignatures = useServerFn(prepareReceiptSignatures)
  const canFees = useCan("people:fees:write")
  const download = useServerFn(downloadReceipt)
  const downloadToSign = useServerFn(downloadReceiptsToSign)
  const retry = useServerFn(retryReceipt)
  const refresh = useRefreshAfter()

  const mine = page.receipts.filter((receipt) => receipt.status === "toSign" && receipt.signer === page.viewerSigner)
  const batch = mine.slice(0, RECEIPT_SIGN_BATCH)
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
  const uploadKey = useOpenGeneration(uploadOpen)
  const [voiding, setVoiding] = useState<Receipt | null>(null)
  const [voidOpen, setVoidOpen] = useState(false)
  const voidKey = useOpenGeneration(voidOpen)
  const { busy: downloading, download: downloadFile } = useFileDownload()
  const [retrying, setRetrying] = useState<string | null>(null)

  const inScope = scope === "all" ? page.receipts : page.receipts.filter((receipt) => receipt.status === scope)
  const filtered = inScope.filter((receipt) => matchesQuery(receipt, deferredQuery))
  const rows = filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
  const narrowed = deferredQuery !== ""

  const signerName = (receipt: Receipt) => {
    if (receipt.signer === page.viewerSigner) return "You"
    const officer = receipt.signer === "president" ? page.officers.president : page.officers.vicePresident
    return officer?.name ?? SIGNER_LABEL[receipt.signer]
  }

  async function prepareSigning() {
    const prepared = await prepareSignatures({ data: { receiptIds: batch.map((receipt) => receipt.id) } })
    // The requests are already saved; a reload failure must not ask the officer to create them again.
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.warning("Signing requests prepared, but the page couldn't refresh.")
    }
    return prepared.map(({ requestId, title }) => ({ requestId, title }))
  }

  async function saveToSign() {
    const saved = await downloadFile("toSign", downloadToSign, "Couldn't download the receipts to sign.")
    if (saved)
      appToast.success(`${pluralize(mine.length, "receipt")} downloaded. Sign them, then upload the signed files.`)
  }

  async function resend(receipt: Receipt) {
    setRetrying(receipt.id)
    try {
      await retry({ data: { receiptId: receipt.id } })
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, `Couldn't send receipt ${receipt.number}.`))
      return
    } finally {
      setRetrying(null)
    }
    await refresh(`Receipt ${receipt.number} sent to ${receipt.person.name}.`)
  }

  function openVoid(receipt: Receipt) {
    setVoiding(receipt)
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
            <div className="flex min-w-0 items-start gap-2 [&>button]:h-10">
              {canWebSign && batch.length > 0 ? (
                <div className="flex min-w-0 flex-1 flex-col shell:max-w-sm [&>button]:w-full">
                  <SignWithCie prepare={prepareSigning}>Sign {pluralize(batch.length, "receipt")} with CIE</SignWithCie>
                </div>
              ) : null}
              {!canWebSign && mine.length > 0 ? (
                <LoadingButton
                  size="sm"
                  icon={FileArchive}
                  pending={downloading === "toSign"}
                  onClick={() => void saveToSign()}
                >
                  Download to sign ({mine.length})
                </LoadingButton>
              ) : null}
              <ActionMenu
                label="Receipt signing options"
                actions={[
                  canWebSign &&
                    mine.length > 0 && {
                      label: "Download to sign",
                      icon: FileArchive,
                      onClick: () => {
                        if (downloading !== "toSign") void saveToSign()
                      },
                    },
                  { label: "Upload signed", icon: Upload, onClick: () => setUploadOpen(true) },
                ]}
              />
            </div>
          ) : undefined
        }
        left={
          <Toolbar
            lead={
              page.years.length > 1 ? (
                <FilterMenu
                  label="Fee year"
                  mono
                  value={page.year}
                  options={page.years.map((year) => ({ value: year, label: year }))}
                  onChange={onYear}
                />
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
                {pluralize(mine.length, "receipt")} {mine.length === 1 ? "is" : "are"} waiting for your signature.
              </span>{" "}
              {canWebSign
                ? `Sign here with CIE and PoliNetwork eSign, up to ${RECEIPT_SIGN_BATCH} receipts at a time. You can also download them and upload the signed files from the signing options.`
                : "Download them, sign each PDF with the CIE app, then upload the signed files."}
              {othersNote(others)}
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
              {pluralize(failed.length, "receipt")} couldn't be emailed. Check the member's address, then retry.
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
                      pending={retrying === receipt.id}
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
                  pending={downloading === receipt.id}
                  onClick={() =>
                    void downloadFile(
                      receipt.id,
                      () => download({ data: { receiptId: receipt.id } }),
                      `Couldn't download receipt ${receipt.number}.`
                    )
                  }
                />
                {canFees ? (
                  <ActionMenu
                    keepSlot
                    label={`More actions for ${receipt.number}`}
                    actions={[
                      receipt.status !== "voided" && {
                        label: "Void receipt",
                        ariaLabel: `Void receipt ${receipt.number}`,
                        icon: Ban,
                        destructive: true,
                        onClick: () => openVoid(receipt),
                      },
                    ]}
                  />
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
