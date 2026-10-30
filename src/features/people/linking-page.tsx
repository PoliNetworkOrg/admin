import { Mail, RefreshCw, X } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  RowActions,
  StatusBadge,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { type AccountAction, AccountActionDialog } from "./account-action-dialog"
import { formatDay, isExpired } from "./people-format"
import { PersonCell } from "./people-ui"
import type { Invite } from "./people.contract"

/**
 * People › Linking: invites still waiting. A record is linked to a sign-in by an accepted invite, or by hand with Link
 * account on the person's record.
 */
export function LinkingPage({ invites }: { invites: Invite[] }) {
  const canWrite = useCan("people:write")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)

  const matches = (values: string[]) =>
    !deferredQuery || values.some((value) => value.toLocaleLowerCase().includes(deferredQuery))
  const inviteRows = invites
    .filter((invite) => matches([invite.name, invite.email]))
    .toSorted((a, b) => a.expiresOn.localeCompare(b.expiresOn))

  function openInvite(kind: "resend" | "revoke", invite: Invite) {
    setAccountAction({ kind, personId: invite.personId, name: invite.name, email: invite.email })
    setAccountOpen(true)
  }

  const inviteColumns: DataTableColumn<Invite>[] = [
    {
      id: "person",
      label: "Person",
      fill: true,
      minWidth: 200,
      mobile: "main",
      cell: (invite) => <PersonCell name={invite.name} secondary={invite.personId} secondaryMono />,
    },
    {
      id: "email",
      label: "Email",
      width: 264,
      mobile: "full",
      cell: (invite) => <span className="block truncate font-mono text-[13px]">{invite.email}</span>,
    },
    {
      id: "sent",
      label: "Sent on",
      width: 120,
      priority: 3,
      mobile: "hidden",
      cell: (invite) => <span className="whitespace-nowrap">{formatDay(invite.sentOn)}</span>,
    },
    {
      id: "expires",
      label: "Expires on",
      width: 168,
      mobile: "meta",
      cell: (invite) =>
        isExpired(invite.expiresOn) ? (
          <StatusBadge tone="danger">Expired {formatDay(invite.expiresOn)}</StatusBadge>
        ) : (
          <span className="whitespace-nowrap">{formatDay(invite.expiresOn)}</span>
        ),
    },
    {
      id: "sentBy",
      label: "Sent by",
      width: 144,
      priority: 4,
      mobile: "hidden",
      cell: (invite) => <span className="block truncate">{invite.sentBy}</span>,
    },
  ]

  return (
    <>
      <PageBar
        description="Pending invites. To link or unlink an account by hand, open the person's record."
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery, placeholder: "Search invites…" }}
            count={
              deferredQuery ? (
                <Count value={inviteRows.length} total={invites.length} noun="invite" plural="invites" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <DataTable
          label="Pending invites"
          columns={inviteColumns}
          rows={inviteRows}
          getRowId={(invite) => invite.personId}
          rowLabel={(invite) => invite.name}
          rowHref={(invite) => `/dashboard/people/${invite.personId}`}
          actions={
            canWrite
              ? (invite) => (
                  <RowActions>
                    <IconButton
                      label="Resend invite"
                      ariaLabel={`Resend invite to ${invite.name}`}
                      icon={RefreshCw}
                      onClick={() => openInvite("resend", invite)}
                    />
                    <IconButton
                      label="Revoke invite"
                      ariaLabel={`Revoke invite to ${invite.name}`}
                      icon={X}
                      tone="danger"
                      onClick={() => openInvite("revoke", invite)}
                    />
                  </RowActions>
                )
              : undefined
          }
          actionsWidth={96}
          empty={
            deferredQuery ? (
              <EmptyState
                icon={Mail}
                title="No invites match"
                text="Try another name or email."
                action={
                  <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Mail}
                title="No pending invites"
                text="Invites you send from a person's record appear here until they're accepted."
              />
            )
          }
        />
      </PageContent>
      {canWrite ? (
        <AccountActionDialog action={accountAction} open={accountOpen} onOpenChange={setAccountOpen} />
      ) : null}
    </>
  )
}
