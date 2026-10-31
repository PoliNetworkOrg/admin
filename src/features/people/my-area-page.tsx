import { Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ChevronRight, Crown, Send, ShieldUser, UserRound, Users, UsersRound } from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  type KeyValueItem,
  KeyValueList,
  PlatformGlyph,
  SectionCard,
  SectionHeading,
  Unset,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { MyFeeCard } from "./my-fee-card"
import {
  assignmentLabel,
  formatDay,
  isTeamAssignment,
  LINK_METHOD,
  openAssignments,
  personName,
  teamName,
  telegramUrl,
} from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { acceptMyInvite } from "./people-self.functions"
import { AssignmentBadge, PersonAvatar, PersonCell, RefusalText, Row, RowIcon, Rows } from "./people-ui"
import type { MyArea } from "./people.contract"

type Linked = Extract<MyArea, { state: "linked" }>

/** Account › My area: what the signed-in person's record says. */
export function MyAreaPage({ area, invite }: { area: MyArea; invite: string | null }) {
  if (invite && area.state !== "linked") return <InviteView token={invite} />
  if (area.state === "none") return <NoRecordView />
  return <LinkedView area={area} />
}

/** Opened from the invite link HR emails. */
function InviteView({ token }: { token: string }) {
  const accept = useServerFn(acceptMyInvite)
  const navigate = useNavigate()
  const refresh = useRefreshAfter()
  const [pending, setPending] = useState(false)
  const dropInvite = () => navigate({ to: "/dashboard/account/me", search: {}, replace: true })

  async function link() {
    setPending(true)
    try {
      await accept({ data: { token } })
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, "Couldn't link your account. Try again."))
      setPending(false)
      return
    }
    await refresh("Account linked.")
    await dropInvite()
  }

  return (
    <>
      <PageBar title="Welcome" width="settings" />
      <PageContent width="settings">
        <SectionCard
          title="Link your account"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" className={buttonMotion} disabled={pending} onClick={() => void dropInvite()}>
                Not now
              </Button>
              <Button className={buttonMotion} disabled={pending} onClick={link}>
                Link my account
              </Button>
            </div>
          }
        >
          <p className="text-[14px] text-(--pn-fg-muted)">
            HR invited you to link this sign-in to your PoliNetwork record, so you get your roles. You can use any
            account, not only the one at the address the invite was sent to. The link works once.
          </p>
        </SectionCard>
      </PageContent>
    </>
  )
}

function NoRecordView() {
  return (
    <>
      <PageBar width="settings" />
      <PageContent width="settings">
        <EmptyState
          icon={UserRound}
          title="You're not on the volunteer lists"
          text="If you administer groups or belong to a team, ask HR to add you. They link your sign-in to your record with an invite or by hand."
        />
      </PageContent>
    </>
  )
}

function LinkedView({ area }: { area: Linked }) {
  const { person, contacts, roster } = area
  // The fee card is an unconnected mockup (Phase 2, #144), shown only to People readers.
  const canRead = useCan("people:read")
  const roles = openAssignments(person)
  const name = personName(person)

  const profileItems: KeyValueItem[] = [
    {
      key: "Contact email",
      value: person.contactEmail ? <span className="[overflow-wrap:anywhere]">{person.contactEmail}</span> : null,
    },
    { key: "Phone", value: person.phone },
    {
      key: "Telegram",
      value: person.telegramUsername ? (
        <span className="inline-flex items-center gap-1.5 font-mono">
          <PlatformGlyph platform="tg" className="size-3.5" />@{person.telegramUsername}
        </span>
      ) : null,
    },
    ...(person.account.status === "linked"
      ? [
          {
            key: "Linked account",
            value: <span className="font-mono [overflow-wrap:anywhere]">{person.account.sub}</span>,
          },
          {
            key: "Linked",
            value: `${LINK_METHOD[person.account.method]}${person.account.linkedOn ? ` · ${formatDay(person.account.linkedOn)}` : ""}`,
          },
        ]
      : []),
  ]

  const rosterColumns: DataTableColumn<NonNullable<Linked["roster"]>["members"][number]>[] = [
    {
      id: "name",
      label: "Name",
      fill: true,
      minWidth: 200,
      mobile: "main",
      cell: (row) => <PersonCell name={row.name} suffix={row.id === person.id ? "(you)" : undefined} />,
    },
    {
      id: "role",
      label: "Role",
      width: 104,
      mobile: "meta",
      cell: (row) => <Chip>{row.role === "lead" ? "Lead" : "Member"}</Chip>,
    },
    {
      id: "telegram",
      label: "Telegram",
      width: 200,
      mobile: "meta",
      cell: (row) =>
        row.telegram ? (
          <a
            href={telegramUrl(row.telegram)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[13px] hover:text-(--pn-accent)"
          >
            <PlatformGlyph platform="tg" className="size-3.5 shrink-0" />
            <span className="truncate">@{row.telegram.replace(/^@/, "")}</span>
          </a>
        ) : (
          <Unset />
        ),
    },
  ]

  return (
    <>
      <PageBar description={`${name} · ${person.id}`} />
      <PageContent>
        <div className="flex flex-col gap-6">
          {canRead ? <MyFeeCard /> : null}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard title="My roles" padding="flush">
                {roles.length ? (
                  <Rows>
                    {roles.map((assignment) => (
                      <Row
                        key={assignment.id}
                        lead={
                          <RowIcon
                            icon={assignment.kind === "admin" ? ShieldUser : assignment.kind === "capo" ? Crown : Users}
                          />
                        }
                        title={
                          isTeamAssignment(assignment) ? (
                            <>
                              {teamName(assignment.team)}
                              <Chip>{assignment.teamRole === "lead" ? "Lead" : "Member"}</Chip>
                            </>
                          ) : (
                            assignmentLabel(assignment)
                          )
                        }
                        meta={`Since ${formatDay(assignment.since)}`}
                        detail={
                          assignment.status === "refused" ? <RefusalText refusal={assignment.refusal} /> : undefined
                        }
                        end={
                          <>
                            <AssignmentBadge assignment={assignment} />
                            {assignment.status === "applied" && assignment.kind === "capo" ? (
                              <IconButton
                                label="Open Capo Admin"
                                icon={ChevronRight}
                                nativeButton={false}
                                render={<Link to="/dashboard/telegram/capo" />}
                              />
                            ) : null}
                            {assignment.status === "applied" &&
                            isTeamAssignment(assignment) &&
                            assignment.teamRole === "lead" ? (
                              <IconButton
                                label="Open your team"
                                icon={ChevronRight}
                                nativeButton={false}
                                render={<Link to="/dashboard/people/teams" />}
                              />
                            ) : null}
                          </>
                        }
                      />
                    ))}
                  </Rows>
                ) : (
                  <p className="px-4 py-3 text-[13px] text-(--pn-fg-muted)">No current roles.</p>
                )}
              </SectionCard>

              <SectionCard title="People to contact" padding="flush">
                {contacts.length ? (
                  <Rows>
                    {contacts.map((contact) => (
                      <Row
                        key={`${contact.role}-${contact.name}-${contact.team ?? ""}`}
                        lead={
                          contact.role === "hr" ? <RowIcon icon={UsersRound} /> : <PersonAvatar name={contact.name} />
                        }
                        title={contact.name}
                        meta={
                          contact.role === "capo"
                            ? "Your Capo Admin"
                            : contact.role === "lead"
                              ? `Your Team Lead · ${contact.team ? teamName(contact.team) : ""}`
                              : "HR, for anything about your record"
                        }
                        end={
                          contact.telegram ? (
                            <IconButton
                              label="Open in Telegram"
                              ariaLabel={`Open ${contact.name} in Telegram`}
                              icon={Send}
                              iconNode={<PlatformGlyph platform="tg" className="size-4" />}
                              nativeButton={false}
                              render={<a href={telegramUrl(contact.telegram)} target="_blank" rel="noreferrer" />}
                            />
                          ) : undefined
                        }
                      />
                    ))}
                  </Rows>
                ) : (
                  <p className="px-4 py-3 text-[13px] text-(--pn-fg-muted)">Nobody to list yet.</p>
                )}
              </SectionCard>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard title="My record">
                <KeyValueList items={profileItems} />
              </SectionCard>
            </div>
          </div>

          {roster ? (
            <section className="flex flex-col gap-3" aria-labelledby="my-team">
              <SectionHeading id="my-team" title={`${teamName(roster.team)} team`} count={roster.members.length} />
              <DataTable
                label={`${teamName(roster.team)} team`}
                columns={rosterColumns}
                rows={roster.members}
                getRowId={(row) => row.id}
                rowLabel={(row) => row.name}
                empty={<EmptyState icon={Users} title="No team members yet" text="Your Team Lead adds people here." />}
              />
            </section>
          ) : null}
        </div>
      </PageContent>
    </>
  )
}
