import { Link, useNavigate } from "@tanstack/react-router"
import { FileSignature, Files, Plus } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { AvatarGroup, DataTable, type DataTableColumn, EmptyState, Hint, InlineAlert } from "@/components/primitives"
import { SegmentedControl } from "@/components/primitives/segmented-control"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { EsignRequest } from "@/lib/api/types"
import { formatDate, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { computerOnly, phoneOnly } from "./action-card"
import { RequestStatusBadge, type StatusFilter, signedProgress } from "./request-status"
import { useSigningDevice } from "./signing-device"

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

function NewRequestButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  return (
    <Button variant={variant} className="h-10" nativeButton={false} render={<Link to="/dashboard/esign/new" />}>
      <Plus aria-hidden /> New request
    </Button>
  )
}

/** Whom a request in progress waits on; the viewer's own turn shows as a badge, so it keeps the progress. */
function turnText(request: EsignRequest) {
  const name = request.signers.find((s) => s.sub === request.turn[0])?.name
  if (request.myTurn || !name) return signedProgress(request)
  return request.turn.length > 1 ? `Waiting for ${name} and ${request.turn.length - 1} more` : `Waiting for ${name}`
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
        <span className="truncate text-xs text-(--pn-fg-muted)">Requested by {r.createdByName}</span>
      </span>
    ),
  },
  { id: "status", label: "Status", width: 150, mobile: "end", cell: (r) => <RequestStatusBadge request={r} /> },
  {
    id: "signers",
    label: "Signers",
    width: 260,
    priority: 1,
    cell: (r) => {
      const text = r.status === "in_progress" ? turnText(r) : null
      return (
        <span className="flex min-w-0 items-center gap-2">
          <AvatarGroup
            people={r.signers.map((s) => ({ id: s.id, name: s.name }))}
            max={4}
            listLabel={`Signers of ${r.title}`}
          />
          {text && (
            <Hint overflowOnly label={text}>
              <span className="min-w-0 truncate text-[13px] text-(--pn-fg-muted) tabular-nums">{text}</span>
            </Hint>
          )}
        </span>
      )
    },
  },
  {
    id: "created",
    label: "Created",
    width: 130,
    priority: 2,
    cell: (r) => <span className="tabular-nums whitespace-nowrap">{formatDate(new Date(r.createdAt))}</span>,
  },
]

// Every document in To sign is the viewer's turn.
const inboxColumns = columns.filter((column) => column.id !== "status")

/** The signatures inbox ("To sign") and the requests list share this page; the list's status lives in the URL. */
export function EsignRequestsPage({
  requests,
  scope,
  status = "all",
  onStatusChange,
}: {
  requests: EsignRequest[]
  scope: "inbox" | "mine" | "all"
  status?: StatusFilter
  onStatusChange?: (status: StatusFilter) => void
}) {
  const canManage = useCan("esign:requests:manage")
  // Until hydration a Mac may be an iPad: both the button and the note render, and CSS shows one.
  const device = useSigningDevice()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase())
  const inbox = scope === "inbox"

  const visible = useMemo(
    () =>
      requests.filter(
        (r) =>
          inFilter(r, status) &&
          (deferred === "" ||
            `${r.title} ${r.createdByName} ${r.signers.map((s) => s.name).join(" ")}`
              .toLocaleLowerCase()
              .includes(deferred))
      ),
    [requests, status, deferred]
  )
  const narrowed = visible.length !== requests.length
  const waiting = inbox ? requests.filter((r) => r.myTurn).length : 0

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
          inbox
            ? waiting > 1 &&
              device !== "phone" && (
                <Button
                  className={cn("h-10", device === "unknown" && computerOnly)}
                  nativeButton={false}
                  render={<Link to="/dashboard/esign/sign" />}
                >
                  <Files aria-hidden /> Sign {waiting} together
                </Button>
              )
            : canManage && <NewRequestButton />
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
                      void navigate({ to: "/dashboard/esign/requests", search: (prev) => ({ ...prev, scope: value }) })
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
                    value={status}
                    onValueChange={(next) => onStatusChange?.(next)}
                  />
                )
              }
              count={narrowed ? <Count value={visible.length} total={requests.length} noun="request" /> : undefined}
            />
          ) : undefined
        }
      />
      <PageContent>
        {waiting > 1 && device !== "computer" && (
          <div className={cn("mb-4", device === "unknown" && phoneOnly)}>
            <InlineAlert tone="info">
              Signing needs your computer with the card reader and PoliNetwork eSign. These documents will be waiting
              here.
            </InlineAlert>
          </div>
        )}
        <DataTable
          label={inbox ? "Documents to sign" : "Signature requests"}
          columns={inbox ? inboxColumns : columns}
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
                action={!inbox && canManage ? <NewRequestButton variant="outline" /> : undefined}
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
                      onStatusChange?.("all")
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
