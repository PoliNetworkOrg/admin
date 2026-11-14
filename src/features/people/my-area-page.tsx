import { Link } from "@tanstack/react-router"
import { ChevronRight, Crown, Send, ShieldUser, UserRound, Users, UsersRound } from "lucide-react"

import {
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  InlineAlert,
  type KeyValueItem,
  KeyValueList,
  PlatformGlyph,
  SectionCard,
  SectionHeading,
  Unset,
} from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { MySocioCards } from "@/features/soci/my-socio-card"
import { formatMemberNumber } from "@/features/soci/soci-format"
import type { Me } from "@/features/soci/soci.contract"

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
import { AssignmentBadge, PersonAvatar, PersonCell, RefusalText, Row, RowIcon, Rows } from "./people-ui"
import type { MyArea } from "./people.contract"

type Linked = Extract<MyArea, { state: "linked" }>

/** The signed-in account's socio record; `null` when it isn't a socio's, `"error"` when it couldn't be read. */
export type MySocio = Me | null | "error"

/**
 * Account › My area: what the signed-in person's People record says, and their Socio card when their Microsoft 365
 * account is a socio's. A socio without a People record sees only the Socio card.
 */
export function MyAreaPage({ area, socio }: { area: MyArea; socio: MySocio }) {
  if (area.state === "none") return socio === null ? <NoRecordView /> : <SocioOnlyView socio={socio} />
  return <LinkedView area={area} socio={socio} />
}

function SocioSection({ socio }: { socio: Exclude<MySocio, null> }) {
  if (socio === "error")
    return (
      <InlineAlert tone="danger">
        Your socio record couldn't be loaded, so your fee and details aren't shown. Reload the page to try again.
      </InlineAlert>
    )
  return <MySocioCards me={socio} />
}

function SocioOnlyView({ socio }: { socio: Exclude<MySocio, null> }) {
  return (
    <>
      <PageBar
        description={
          socio === "error" ? undefined : (
            <>
              {socio.details.firstName} {socio.details.lastName} ·{" "}
              <span className="font-mono">{formatMemberNumber(socio.number)}</span>
            </>
          )
        }
      />
      <PageContent>
        <SocioSection socio={socio} />
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
          text="If you administer groups or belong to a team, ask HR to add you. They link your account to your record with an email invite, which you can accept with any account, or by hand."
        />
      </PageContent>
    </>
  )
}

function LinkedView({ area, socio }: { area: Linked; socio: MySocio }) {
  const { person, contacts, roster } = area
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
          {socio === null ? null : <SocioSection socio={socio} />}

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
