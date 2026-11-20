import { Trash2 } from "lucide-react"
import { useDeferredValue, useState } from "react"

import { DataTable, type DataTableColumn, EmptyState, IconButton, useFocusAfterRemoval } from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { formatDay } from "@/features/people/people-format"
import { useDialog } from "@/features/people/people-hooks"

import { DeleteAccountDialog } from "./lifecycle-dialogs"
import { END_REASON, formatMemberNumber, socioName } from "./soci-format"
import type { SocioRow } from "./soci.contract"

const columns: DataTableColumn<SocioRow>[] = [
  {
    id: "name",
    label: "Name",
    fill: true,
    mobile: "main",
    cell: (s) => (
      <>
        <span>{socioName(s)}</span>
        <span className="mt-1 block break-all font-mono text-xs text-(--pn-fg-muted)">
          {formatMemberNumber(s.number)} · {s.mailbox}
        </span>
        <span className="mt-1 hidden text-xs text-(--pn-fg-muted) max-shell:block">
          {s.endedOn ? formatDay(s.endedOn) : "—"} · {s.endReason ? END_REASON[s.endReason] : "—"}
        </span>
      </>
    ),
  },
  {
    id: "endedOn",
    label: "Ended on",
    width: 150,
    mobile: "hidden",
    cell: (s) => (s.endedOn ? formatDay(s.endedOn) : "—"),
  },
  {
    id: "reason",
    label: "Reason",
    width: 140,
    mobile: "hidden",
    cell: (s) => (s.endReason ? END_REASON[s.endReason] : "—"),
  },
]

export function DeletionPage({ accounts }: { accounts: SocioRow[] }) {
  const canDelete = useCan("soci:delete")
  const dialog = useDialog<SocioRow>()
  const focus = useFocusAfterRemoval<HTMLDivElement>("tbody tr")
  const [query, setQuery] = useState("")
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set())
  const search = useDeferredValue(query.trim().toLocaleLowerCase())
  const pending = accounts.filter((s) => !deleted.has(s.entraObjectId))
  const rows = pending.filter((s) =>
    [socioName(s), s.mailbox, String(s.number), formatMemberNumber(s.number)].some((v) =>
      v.toLocaleLowerCase().includes(search)
    )
  )
  return (
    <>
      <PageBar
        description="Ended memberships whose Microsoft 365 account is pending deletion."
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery }}
            count={<Count value={rows.length} total={pending.length} noun="account" plural="accounts" />}
          />
        }
      />
      <PageContent>
        <div
          ref={focus.surfaceRef}
          tabIndex={-1}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <DataTable
            label="Accounts pending deletion"
            columns={columns}
            rows={rows}
            getRowId={(s) => s.number}
            rowHref={(s) => `/dashboard/people/soci/${s.number}`}
            rowLabel={(s) => socioName(s)}
            actions={
              canDelete
                ? (s) => (
                    <IconButton
                      icon={Trash2}
                      label="Delete account"
                      ariaLabel={`Delete ${s.mailbox}`}
                      onClick={(event) => {
                        focus.capture(event.currentTarget)
                        dialog.show(s)
                      }}
                    />
                  )
                : undefined
            }
            empty={
              <EmptyState
                icon={Trash2}
                title={search ? "No matching accounts" : "No accounts pending deletion"}
                text={search ? "Try another name, number or mailbox." : "Accounts appear here after a membership ends."}
              />
            }
          />
        </div>
      </PageContent>
      {canDelete && dialog.target ? (
        <DeleteAccountDialog
          key={dialog.key}
          open={dialog.open}
          onOpenChange={dialog.onOpenChange}
          socio={dialog.target}
          finalFocus={focus.target}
          onDeleted={(id) => setDeleted((current) => new Set([...current, id]))}
        />
      ) : null}
    </>
  )
}
