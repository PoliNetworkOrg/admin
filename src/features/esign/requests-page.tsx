import { Link, useNavigate } from "@tanstack/react-router"
import { FileSignature, Files, PenLine, Plus } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { AvatarGroup, DataTable, type DataTableColumn, EmptyState } from "@/components/primitives"
import { SegmentedControl } from "@/components/primitives/segmented-control"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { EsignRequest } from "@/lib/api/types"
import { formatDate, pluralize } from "@/lib/format"

import { ReceiptRequestLink } from "./receipt-request-link"
import { RequestStatusBadge, signedProgress } from "./request-status"

type StatusFilter = "all" | "in_progress" | "completed" | "closed"

const SCOPE_ITEMS: { value: "mine" | "all"; label: string }[] = [
  { value: "mine", label: "Mine" },
  { value: "all", label: "Everyone" },
]

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Signed" },
  { value: "closed", label: "Closed" },
]

function inFilter(request: EsignRequest, filter: StatusFilter) {
  if (filter === "all") return true
  if (filter === "closed") return request.status === "cancelled" || request.status === "declined"
  return request.status === filter
}

/** In To sign it starts with the viewer as the first signer, who may then add others. */
function NewRequestButton({ variant = "default", self }: { variant?: "default" | "outline"; self: boolean }) {
  return (
    <Button
      variant={variant}
      className="h-10"
      nativeButton={false}
      render={<Link to="/dashboard/esign/new" search={self ? { self: true } : {}} />}
    >
      {self ? <PenLine aria-hidden /> : <Plus aria-hidden />} {self ? "Sign a document" : "New request"}
    </Button>
  )
}

const columns: DataTableColumn<EsignRequest>[] = [
  {
    id: "title",
    label: "Document",
    fill: true,
    mobile: "main",
    cell: (r) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{r.title}</span>
        {r.peopleReceipt ? (
          <ReceiptRequestLink source={r.peopleReceipt} />
        ) : (
          <span className="truncate text-xs text-(--pn-fg-muted)">Requested by {r.createdByName}</span>
        )}
      </span>
    ),
  },
  { id: "status", label: "Status", width: 150, mobile: "end", cell: (r) => <RequestStatusBadge request={r} /> },
  {
    id: "signers",
    label: "Signers",
    width: 220,
    priority: 1,
    cell: (r) => (
      <span className="flex items-center gap-2">
        <AvatarGroup
          people={r.signers.map((s) => ({ id: s.id, name: s.name }))}
          max={4}
          listLabel={`Signers of ${r.title}`}
        />
        <span className="text-[13px] text-(--pn-fg-muted) tabular-nums">{signedProgress(r)}</span>
      </span>
    ),
  },
  {
    id: "created",
    label: "Created",
    width: 130,
    priority: 2,
    cell: (r) => <span className="tabular-nums whitespace-nowrap">{formatDate(new Date(r.createdAt))}</span>,
  },
]

/** The signatures inbox ("To sign") and the requests list share this page. */
export function EsignRequestsPage({ requests, scope }: { requests: EsignRequest[]; scope: "inbox" | "mine" | "all" }) {
  const canManage = useCan("esign:requests:manage")
  const canSignReceipts = useCan("people:receipts:sign")
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase())
  const inbox = scope === "inbox"

  const visible = useMemo(
    () =>
      requests.filter(
        (r) =>
          inFilter(r, inbox ? "all" : filter) &&
          (deferred === "" ||
            `${r.title} ${r.createdByName} ${r.signers.map((s) => s.name).join(" ")}`
              .toLocaleLowerCase()
              .includes(deferred))
      ),
    [requests, filter, deferred, inbox]
  )
  const narrowed = visible.length !== requests.length
  const waiting = inbox ? requests.filter((r) => r.myTurn && (!r.peopleReceipt || canSignReceipts)).length : 0

  const description = inbox
    ? requests.length
      ? `${pluralize(requests.length, "document")} waiting for your signature`
      : "Documents that need your CIE signature appear here"
    : pluralize(requests.length, "request")

  return (
    <>
      <PageBar
        description={description}
        right={
          canManage || waiting > 1 ? (
            <>
              {canManage && <NewRequestButton variant={waiting > 1 ? "outline" : "default"} self={inbox} />}
              {waiting > 1 && (
                <Button className="h-10" nativeButton={false} render={<Link to="/dashboard/esign/sign" />}>
                  <Files aria-hidden /> Sign {waiting} together
                </Button>
              )}
            </>
          ) : undefined
        }
        left={
          // Managers keep the Mine/Everyone switch even when they have no requests of their own.
          requests.length > 0 || (!inbox && canManage) ? (
            <Toolbar
              lead={
                !inbox && canManage ? (
                  <SegmentedControl
                    label="Whose requests"
                    items={SCOPE_ITEMS}
                    value={scope}
                    onValueChange={(value) =>
                      void navigate({ to: "/dashboard/esign/requests", search: { scope: value } })
                    }
                  />
                ) : undefined
              }
              search={requests.length > 0 ? { value: query, onChange: setQuery } : undefined}
              filters={
                inbox || requests.length === 0 ? undefined : (
                  <SegmentedControl
                    label="Status"
                    items={STATUS_ITEMS.map((item) => ({
                      ...item,
                      count: requests.filter((r) => inFilter(r, item.value)).length,
                    }))}
                    value={filter}
                    onValueChange={setFilter}
                  />
                )
              }
              count={narrowed ? <Count value={visible.length} total={requests.length} noun="request" /> : undefined}
            />
          ) : undefined
        }
      />
      <PageContent>
        <DataTable
          label={inbox ? "Documents to sign" : "Signature requests"}
          columns={columns}
          rows={visible}
          getRowId={(r) => r.id}
          rowHref={(r) => `/dashboard/esign/requests/${r.id}`}
          rowLabel={(r) => r.title}
          onRowClick={(r) => void navigate({ to: "/dashboard/esign/requests/$requestId", params: { requestId: r.id } })}
          empty={
            requests.length === 0 ? (
              <EmptyState
                icon={FileSignature}
                title={inbox ? "Nothing to sign" : "No requests yet"}
                text={
                  inbox
                    ? "When someone asks for your signature, the document shows up here."
                    : "Start a request from a PDF in OneDrive or on your computer, choose who signs and where."
                }
                action={canManage ? <NewRequestButton variant="outline" self={inbox} /> : undefined}
              />
            ) : (
              <EmptyState
                icon={FileSignature}
                title="No requests match"
                text="Try another search or status."
                action={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setQuery("")
                      setFilter("all")
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      </PageContent>
    </>
  )
}
