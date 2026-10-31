import { Link2, Mail, RefreshCw, Unlink, UserRoundCheck, X } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  ChipOverflow,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  RowActions,
  SegmentedControl,
  StatusBadge,
  Unset,
  useOpenGeneration,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { type AccountAction, AccountActionDialog } from "./account-action-dialog"
import { LinkAccountDialog, UnlinkAccountDialog } from "./link-account-dialog"
import {
  actorName,
  assignmentLabel,
  currentAssignments,
  formatDay,
  isExpired,
  LINK_METHOD,
  personName,
  waitingForAuth,
} from "./people-format"
import { PersonCell, TruncatedChip } from "./people-ui"
import type { Invite, PersonRow, RecentLink } from "./people.contract"

type Tab = "unlinked" | "invites" | "recent"
type Target = { id: string; name: string; firstName: string; roles: number }

/** The roles a record would get once linked. */
function RolesCell({ person }: { person: PersonRow | undefined }) {
  const roles = person ? currentAssignments(person).map(assignmentLabel) : []
  if (!roles.length) return <Unset />
  return (
    <ChipOverflow
      items={roles}
      max={2}
      itemLabel={(role) => role}
      renderItem={(role) => <TruncatedChip key={role} label={role} />}
    />
  )
}

function matches(query: string, values: (string | null)[]) {
  return !query || values.some((value) => (value ?? "").toLocaleLowerCase().includes(query))
}

/**
 * People › Linking: the records without an account, the invites waiting to be accepted, and the links of the last 30
 * days. A record is linked in two ways only: the person accepts an email invite with any account, or someone with
 * `people:link` links one by hand. Nothing is matched automatically, so Recently linked is where a mistake, or a
 * forwarded invite, is spotted and undone.
 */
export function LinkingPage({
  people,
  invites,
  recent,
}: {
  people: PersonRow[]
  invites: Invite[]
  recent: RecentLink[]
}) {
  const canWrite = useCan("people:write")
  const canLink = useCan("people:link")
  const [tab, setTab] = useState<Tab>("unlinked")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<Target | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const linkKey = useOpenGeneration(linkOpen)
  const [unlinkTarget, setUnlinkTarget] = useState<Target | null>(null)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const unlinkKey = useOpenGeneration(unlinkOpen)

  const byId = new Map(people.map((person) => [person.id, person]))
  const target = (person: PersonRow): Target => ({
    id: person.id,
    name: personName(person),
    firstName: person.firstName,
    roles: currentAssignments(person).length,
  })
  const unlinked = people
    .filter((person) => person.account.status === "none")
    .filter((person) => matches(deferredQuery, [personName(person), person.contactEmail, person.id]))
    .toSorted((a, b) => personName(a).localeCompare(personName(b)))
  const inviteRows = invites
    .filter((invite) => matches(deferredQuery, [invite.name, invite.email, invite.personId]))
    .toSorted((a, b) => a.expiresOn.localeCompare(b.expiresOn))
  const recentRows = recent.filter((link) =>
    matches(deferredQuery, [link.person.name, link.email, link.sub, link.person.id])
  )
  const totals = {
    unlinked: people.filter((person) => person.account.status === "none").length,
    invites: invites.length,
    recent: recent.length,
  }
  const shown = { unlinked: unlinked.length, invites: inviteRows.length, recent: recentRows.length }
  const nouns = {
    unlinked: ["record", "records"],
    invites: ["invite", "invites"],
    recent: ["link", "links"],
  } as const satisfies Record<Tab, readonly [string, string]>

  function openInvite(kind: AccountAction["kind"], personId: string, name: string, email: string) {
    setAccountAction({ kind, personId, name, email })
    setAccountOpen(true)
  }

  function openLink(person: PersonRow | undefined) {
    if (!person) return
    setLinkTarget(target(person))
    setLinkOpen(true)
  }

  const linkButton = (person: PersonRow | undefined, name: string) =>
    canLink && person ? (
      <IconButton
        label="Link account"
        ariaLabel={`Link an account to ${name}`}
        icon={Link2}
        onClick={() => openLink(person)}
      />
    ) : null

  const unlinkedColumns: DataTableColumn<PersonRow>[] = [
    {
      id: "person",
      label: "Person",
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (person) => <PersonCell name={personName(person)} secondary={person.contactEmail ?? "No contact email"} />,
    },
    {
      id: "roles",
      label: "Roles waiting",
      width: 264,
      mobile: "full",
      cell: (person) => <RolesCell person={person} />,
    },
  ]

  const inviteColumns: DataTableColumn<Invite>[] = [
    {
      id: "person",
      label: "Person",
      fill: true,
      minWidth: 200,
      mobile: "main",
      cell: (invite) => <PersonCell name={invite.name} secondary={invite.email} />,
    },
    {
      id: "roles",
      label: "Roles waiting",
      width: 224,
      priority: 4,
      mobile: "hidden",
      cell: (invite) => <RolesCell person={byId.get(invite.personId)} />,
    },
    {
      id: "sent",
      label: "Sent",
      width: 184,
      priority: 3,
      mobile: "hidden",
      cell: (invite) => (
        <span className="flex min-w-0 flex-col">
          <span className="whitespace-nowrap">{formatDay(invite.sentOn)}</span>
          <span className="truncate text-xs text-(--pn-fg-muted)">by {actorName(invite.sentBy, people)}</span>
        </span>
      ),
    },
    {
      id: "expires",
      label: "Expires",
      width: 168,
      mobile: "meta",
      cell: (invite) =>
        isExpired(invite.expiresOn) ? (
          <StatusBadge tone="danger">Expired {formatDay(invite.expiresOn)}</StatusBadge>
        ) : (
          <span className="whitespace-nowrap">{formatDay(invite.expiresOn)}</span>
        ),
    },
  ]

  const recentColumns: DataTableColumn<RecentLink>[] = [
    {
      id: "person",
      label: "Person",
      fill: true,
      minWidth: 200,
      mobile: "main",
      cell: (link) => <PersonCell name={link.person.name} secondary={link.person.id} secondaryMono />,
    },
    {
      id: "account",
      label: "Account",
      width: 248,
      mobile: "full",
      cell: (link) => (
        <span className="block truncate font-mono text-[13px]" title={link.sub}>
          {link.email ?? link.sub}
        </span>
      ),
    },
    {
      id: "method",
      label: "How",
      width: 200,
      priority: 3,
      mobile: "meta",
      cell: (link) => <span className="block truncate">{LINK_METHOD[link.method]}</span>,
    },
    {
      id: "linked",
      label: "Linked",
      width: 184,
      mobile: "meta",
      cell: (link) => (
        <span className="flex min-w-0 flex-col">
          <span className="whitespace-nowrap">{formatDay(link.linkedOn)}</span>
          <span className="truncate text-xs text-(--pn-fg-muted)">
            {link.linkedBy ? `by ${actorName(link.linkedBy, people)}` : "by an unknown account"}
          </span>
        </span>
      ),
    },
  ]

  const emptyMatch = (
    <EmptyState
      icon={Link2}
      title="Nothing matches"
      text="Try another name, email or ID."
      action={
        <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
          Clear search
        </Button>
      }
    />
  )

  return (
    <>
      <PageBar
        description="Link records to sign-in accounts: by an email invite, accepted with any account, or by hand."
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery, placeholder: "Search by name, email or ID…" }}
            filters={
              <SegmentedControl<Tab>
                label="Show"
                items={[
                  { value: "unlinked", label: "Not linked", count: totals.unlinked },
                  { value: "invites", label: "Invites", count: totals.invites },
                  { value: "recent", label: "Recently linked", count: totals.recent },
                ]}
                value={tab}
                onValueChange={setTab}
              />
            }
            count={
              deferredQuery ? (
                <Count value={shown[tab]} total={totals[tab]} noun={nouns[tab][0]} plural={nouns[tab][1]} />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        {tab === "unlinked" ? (
          <DataTable
            label="Records without an account"
            columns={unlinkedColumns}
            rows={unlinked}
            getRowId={(person) => person.id}
            rowLabel={personName}
            rowHref={(person) => `/dashboard/people/${person.id}`}
            actions={
              canWrite || canLink
                ? (person) => (
                    <RowActions>
                      {canWrite && person.contactEmail ? (
                        <IconButton
                          label="Send invite"
                          ariaLabel={`Send invite to ${personName(person)}`}
                          icon={Mail}
                          onClick={() => openInvite("invite", person.id, personName(person), person.contactEmail ?? "")}
                        />
                      ) : (
                        <span aria-hidden className="size-9 max-shell:hidden" />
                      )}
                      {linkButton(person, personName(person))}
                    </RowActions>
                  )
                : undefined
            }
            actionsWidth={96}
            empty={
              deferredQuery ? (
                emptyMatch
              ) : (
                <EmptyState
                  icon={UserRoundCheck}
                  title="Every record is linked or invited"
                  text="Records without an account and without an open invite appear here."
                />
              )
            }
          />
        ) : tab === "invites" ? (
          <DataTable
            label="Invites"
            columns={inviteColumns}
            rows={inviteRows}
            getRowId={(invite) => invite.personId}
            rowLabel={(invite) => invite.name}
            rowHref={(invite) => `/dashboard/people/${invite.personId}`}
            actions={
              canWrite || canLink
                ? (invite) => (
                    <RowActions>
                      {canWrite ? (
                        <>
                          <IconButton
                            label="Resend invite"
                            ariaLabel={`Resend invite to ${invite.name}`}
                            icon={RefreshCw}
                            onClick={() => openInvite("resend", invite.personId, invite.name, invite.email)}
                          />
                          <IconButton
                            label="Revoke invite"
                            ariaLabel={`Revoke invite to ${invite.name}`}
                            icon={X}
                            tone="danger"
                            onClick={() => openInvite("revoke", invite.personId, invite.name, invite.email)}
                          />
                        </>
                      ) : null}
                      {linkButton(byId.get(invite.personId), invite.name)}
                    </RowActions>
                  )
                : undefined
            }
            actionsWidth={136}
            empty={
              deferredQuery ? (
                emptyMatch
              ) : (
                <EmptyState
                  icon={Mail}
                  title="No open invites"
                  text="Invites appear here until they're accepted, revoked or replaced."
                />
              )
            }
          />
        ) : (
          <DataTable
            label="Recently linked"
            columns={recentColumns}
            rows={recentRows}
            getRowId={(link) => `${link.person.id}-${link.sub}`}
            rowLabel={(link) => link.person.name}
            rowHref={(link) => `/dashboard/people/${link.person.id}`}
            actions={
              canLink
                ? (link) => {
                    const person = byId.get(link.person.id)
                    return (
                      <RowActions>
                        {person && !waitingForAuth(person) ? (
                          <IconButton
                            label="Unlink"
                            ariaLabel={`Unlink the account of ${link.person.name}`}
                            icon={Unlink}
                            tone="danger"
                            onClick={() => {
                              setUnlinkTarget(target(person))
                              setUnlinkOpen(true)
                            }}
                          />
                        ) : (
                          <span aria-hidden className="size-9" />
                        )}
                      </RowActions>
                    )
                  }
                : undefined
            }
            actionsWidth={56}
            empty={
              deferredQuery ? (
                emptyMatch
              ) : (
                <EmptyState
                  icon={Link2}
                  title="No links in the last 30 days"
                  text="Accepted invites and accounts linked by hand appear here for 30 days."
                />
              )
            }
          />
        )}
      </PageContent>
      {canWrite ? (
        <AccountActionDialog action={accountAction} open={accountOpen} onOpenChange={setAccountOpen} />
      ) : null}
      {canLink && linkTarget ? (
        <LinkAccountDialog
          key={`link-${linkTarget.id}-${linkKey}`}
          open={linkOpen}
          onOpenChange={setLinkOpen}
          person={linkTarget}
        />
      ) : null}
      {canLink && unlinkTarget ? (
        <UnlinkAccountDialog
          key={`unlink-${unlinkTarget.id}-${unlinkKey}`}
          open={unlinkOpen}
          onOpenChange={setUnlinkOpen}
          person={unlinkTarget}
        />
      ) : null}
    </>
  )
}
