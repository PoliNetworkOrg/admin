import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Camera,
  ClipboardList,
  Crown,
  EllipsisVertical,
  FileText,
  IdCard,
  Link2,
  Mail,
  NotebookPen,
  Pencil,
  RefreshCw,
  Unlink,
  UserMinus,
  UserRoundCog,
  Users,
} from "lucide-react"
import { type ReactNode, useState } from "react"

import {
  buttonMotion,
  Chip,
  IconButton,
  InlineAlert,
  KeyValueList,
  type KeyValueItem,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  PlatformGlyph,
  RecordHeader,
  SectionCard,
  SectionEmpty,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"

import { type AccountAction, AccountActionDialog } from "./account-action-dialog"
import { CapoOfReferenceDialog, CapoScopeDialog, EndAdminDialog, EndCapoDialog } from "./admin-dialogs"
import { CensusAnswersDialog } from "./census-answers-dialog"
import { LinkAccountDialog } from "./link-account-dialog"
import { MemberNumberDialog, MemberStatusDialog } from "./member-dialogs"
import { NotesDialog } from "./notes-dialog"
import {
  ACCOUNT_STATUS,
  CENSUS_ANSWER,
  CENSUS_SOURCE,
  CURRENT_YEAR,
  FEE_STATUS,
  formatDay,
  hasNoRoles,
  isExpired,
  MEMBER_STATUS,
  NO_ANSWER,
  personName,
  roleLabels,
  teamName,
  yearOf,
} from "./people-format"
import { useRefreshAfter } from "./people-hooks"
import { MonoChip, PersonAvatar, StateBadge } from "./people-ui"
import { updatePerson } from "./people-write.functions"
import { type PersonRecord, teamFields } from "./people.contract"
import { PersonDialog } from "./person-dialog"

type AdminDialogKind = "end" | "capoRef" | "capoScope" | "endCapo"

const BACK = { label: "people", link: { to: "/dashboard/people" } } as const

/** A divided list inside a flush card: one row per group, team, year or consent. */
function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-(--pn-line)">{children}</ul>
}

function Row({
  lead,
  title,
  meta,
  detail,
  end,
}: {
  lead: ReactNode
  title: ReactNode
  meta?: ReactNode
  detail?: ReactNode
  end?: ReactNode
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0">{lead}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{title}</span>
        {meta ? <span className="text-xs text-(--pn-fg-muted)">{meta}</span> : null}
        {detail ? <span className="text-[13px] text-(--pn-fg)">{detail}</span> : null}
      </span>
      {end ? <span className="flex shrink-0 items-center gap-2">{end}</span> : null}
    </li>
  )
}

function RowIcon({ icon: Icon }: { icon: typeof Users }) {
  return (
    <span className="grid size-8 place-items-center rounded-(--pn-r-3) bg-(--pn-muted) text-(--pn-fg-muted)">
      <Icon aria-hidden strokeWidth={1.75} className="size-4" />
    </span>
  )
}

function SubHeading({ children }: { children: ReactNode }) {
  return <li className="px-4 pt-3 pb-1 text-xs font-medium text-(--pn-fg-muted)">{children}</li>
}

/** People › {name}: the whole record, its discrepancies and its history. */
export function PersonPage({ person }: { person: PersonRecord }) {
  const canWrite = useCan("people:write")
  const canRead = useCan("people:read")
  const canWriteMembers = useCan("people:members:write")
  const canAppoint = useCan("people:appoint")
  const update = useServerFn(updatePerson)
  const refresh = useRefreshAfter()
  const name = personName(person)
  const archived = hasNoRoles(person)
  const roles = roleLabels(person)
  const { profile, admin, member, account } = person
  const adminTarget = { personId: person.id, name, groups: admin?.groups.length ?? 0 }

  const [editOpen, setEditOpen] = useState(false)
  const [editKey, setEditKey] = useState(0)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesKey, setNotesKey] = useState(0)
  const [answersYear, setAnswersYear] = useState<string | null>(null)
  const [answersOpen, setAnswersOpen] = useState(false)
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkKey, setLinkKey] = useState(0)
  const [memberDialog, setMemberDialog] = useState<"status" | "number" | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [memberKey, setMemberKey] = useState(0)

  const [adminDialog, setAdminDialog] = useState<AdminDialogKind | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminKey, setAdminKey] = useState(0)

  function openAdmin(kind: AdminDialogKind) {
    setAdminDialog(kind)
    setAdminKey((value) => value + 1)
    setAdminOpen(true)
  }

  function openMember(kind: "status" | "number") {
    setMemberDialog(kind)
    setMemberKey((value) => value + 1)
    setMemberOpen(true)
  }

  function openAccount(kind: AccountAction["kind"], email: string) {
    setAccountAction({ kind, personId: person.id, name, email })
    setAccountOpen(true)
  }

  async function applyCensusTelegram(username: string) {
    try {
      await update({
        data: {
          id: person.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          personalEmail: profile.personalEmail ?? "",
          phone: profile.phone ?? "",
          telegramUsername: username,
          course: profile.course,
          year: yearOf(profile.year),
          campus: profile.campus,
        },
      })
    } catch (caught) {
      console.error(caught)
      appToast.error("Couldn't update the Telegram username.")
      return
    }
    await refresh("Telegram username updated.")
  }

  const profileItems: KeyValueItem[] = [
    ...(profile.personalEmail !== null
      ? [{ key: "Personal email", value: <span className="[overflow-wrap:anywhere]">{profile.personalEmail}</span> }]
      : []),
    ...(profile.phone !== null ? [{ key: "Phone", value: profile.phone }] : []),
    {
      key: "Telegram",
      value: profile.telegramUsername ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <PlatformGlyph platform="tg" className="size-3.5" />
          <span className="font-mono">@{profile.telegramUsername}</span>
          {profile.telegramId ? <span className="font-mono text-(--pn-fg-muted)">· {profile.telegramId}</span> : null}
        </span>
      ) : null,
    },
    { key: "Course", value: profile.course },
    { key: "Year", value: profile.year },
    { key: "Campus", value: <Chip>{profile.campus}</Chip> },
    {
      key: "Other associations",
      value: profile.otherAssociations.length ? (
        <span className="flex flex-wrap gap-1.5">
          {profile.otherAssociations.map((association) => (
            <Chip key={association}>{association}</Chip>
          ))}
        </span>
      ) : null,
    },
    { key: "Student representative", value: profile.studentRepresentative },
  ]

  return (
    <>
      <PageBar width="record" back={BACK} crumb="People" context={name} />
      <PageContent width="record">
        <div className="flex flex-col gap-6">
          <RecordHeader
            title={name}
            avatar={<PersonAvatar name={name} size={64} muted={archived} />}
            badge={<StateBadge state={ACCOUNT_STATUS[account.status]} />}
            meta={
              <span className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-mono">{person.id}</span>
                <span aria-hidden>·</span>
                <span>{profile.course}</span>
                <span aria-hidden>·</span>
                <span>{profile.year}</span>
                <span aria-hidden>·</span>
                <span>{profile.campus}</span>
              </span>
            }
            chips={roles.length ? roles.map((role) => <Chip key={role}>{role}</Chip>) : undefined}
          />

          {archived || person.discrepancies.length ? (
            <div className="flex flex-col gap-2">
              {archived ? (
                <InlineAlert tone="neutral">
                  No active roles left. The record stays for history and future census campaigns; it no longer appears
                  in team or admin lists.
                </InlineAlert>
              ) : null}
              {person.discrepancies.map((discrepancy) => (
                <InlineAlert
                  key={discrepancy.kind}
                  tone="warning"
                  action={
                    discrepancy.kind === "telegram-mismatch" && discrepancy.suggestedTelegram && canWrite ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={buttonMotion}
                        onClick={() => applyCensusTelegram(discrepancy.suggestedTelegram ?? "")}
                      >
                        Use @{discrepancy.suggestedTelegram}
                      </Button>
                    ) : discrepancy.kind === "declared-member" && canWriteMembers ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={buttonMotion}
                        nativeButton={false}
                        render={<Link to="/dashboard/people/members" search={{ add: person.id }} />}
                      >
                        Add member
                      </Button>
                    ) : discrepancy.kind === "needs-review" && canWrite ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={buttonMotion}
                        nativeButton={false}
                        render={<Link to="/dashboard/people/linking" />}
                      >
                        Open Linking
                      </Button>
                    ) : undefined
                  }
                >
                  {discrepancy.message}
                </InlineAlert>
              ))}
            </div>
          ) : null}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard
                title="Profile"
                action={
                  canWrite ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={buttonMotion}
                      onClick={() => {
                        setEditKey((key) => key + 1)
                        setEditOpen(true)
                      }}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                  ) : undefined
                }
              >
                <KeyValueList items={profileItems} />
              </SectionCard>

              {admin ? (
                <SectionCard
                  title="Admin"
                  padding="flush"
                  action={
                    admin.status === "active" && (canWrite || canAppoint) ? (
                      <Menu>
                        <MenuTrigger
                          render={
                            <IconButton label="Admin actions" ariaLabel="Admin actions" icon={EllipsisVertical} />
                          }
                        />
                        <MenuContent>
                          {canWrite && !admin.capoScope ? (
                            <MenuItem onClick={() => openAdmin("capoRef")}>
                              <UserRoundCog />
                              Capo Admin of reference
                            </MenuItem>
                          ) : null}
                          {canAppoint ? (
                            <MenuItem onClick={() => openAdmin("capoScope")}>
                              <Crown />
                              {admin.capoScope ? "Change Capo Admin scope" : "Appoint as Capo Admin"}
                            </MenuItem>
                          ) : null}
                          {canAppoint && admin.capoScope ? (
                            <MenuItem variant="destructive" onClick={() => openAdmin("endCapo")}>
                              <Crown />
                              End Capo Admin role
                            </MenuItem>
                          ) : null}
                          {canWrite ? (
                            <>
                              <MenuSeparator />
                              <MenuItem variant="destructive" onClick={() => openAdmin("end")}>
                                <UserMinus />
                                End admin role
                              </MenuItem>
                            </>
                          ) : null}
                        </MenuContent>
                      </Menu>
                    ) : undefined
                  }
                >
                  <div className="p-4">
                    <KeyValueList
                      items={[
                        {
                          key: "Status",
                          value: (
                            <StateBadge
                              state={
                                admin.status === "active"
                                  ? { label: "Active", tone: "success" }
                                  : { label: "Former", tone: "neutral" }
                              }
                            />
                          ),
                        },
                        { key: "Active since", value: formatDay(admin.since) },
                        ...(admin.endedOn
                          ? [
                              {
                                key: "Ended",
                                value: `${formatDay(admin.endedOn)}${admin.endReason ? ` · ${admin.endReason}` : ""}`,
                              },
                            ]
                          : []),
                        { key: "Available as Capo Admin", value: admin.availableAsCapo ? "Yes" : "No" },
                        {
                          key: "Capo Admin of reference",
                          value: admin.capoOfReference ? (
                            <Link
                              to="/dashboard/people/$personId"
                              params={{ personId: admin.capoOfReference.id }}
                              className="text-(--pn-accent) hover:underline"
                            >
                              {admin.capoOfReference.name}
                            </Link>
                          ) : null,
                        },
                        ...(admin.capoScope ? [{ key: "Capo Admin of", value: <Chip>{admin.capoScope}</Chip> }] : []),
                      ]}
                    />
                  </div>
                  {admin.status === "active" || admin.requested.length ? (
                    <Rows>
                      {admin.status === "active" ? (
                        <SubHeading>Groups they administer · detected by the bot</SubHeading>
                      ) : null}
                      {admin.status === "active" && admin.groups.length === 0 ? (
                        <Row
                          lead={<RowIcon icon={Users} />}
                          title="No groups"
                          meta="The bot hasn't seen them as admin in any group."
                        />
                      ) : null}
                      {admin.groups.map((group) => (
                        <Row
                          key={group.chatId}
                          lead={<PlatformGlyph platform="tg" className="size-5" />}
                          title={group.title}
                          meta={<span className="font-mono">{group.chatId}</span>}
                        />
                      ))}
                      {admin.requested.length ? <SubHeading>Asked to join</SubHeading> : null}
                      {admin.requested.map((group) => (
                        <Row
                          key={group.chatId}
                          lead={<PlatformGlyph platform="tg" className="size-5" />}
                          title={group.title}
                          meta={`Asked ${formatDay(group.requestedOn)}`}
                          end={<StatusBadge tone="brand">Pending</StatusBadge>}
                        />
                      ))}
                    </Rows>
                  ) : null}
                </SectionCard>
              ) : null}

              {person.teams.length ? (
                <SectionCard title="Teams" padding="flush">
                  <Rows>
                    {person.teams.map((membership) => (
                      <Row
                        key={`${membership.team}-${membership.since}`}
                        lead={<RowIcon icon={Users} />}
                        title={
                          <>
                            <Link
                              to="/dashboard/people/teams/$teamId"
                              params={{ teamId: membership.team }}
                              className="hover:text-(--pn-accent)"
                            >
                              {teamName(membership.team)}
                            </Link>
                            <Chip>{membership.role === "lead" ? "Lead" : "Member"}</Chip>
                          </>
                        }
                        meta={
                          membership.endedOn
                            ? `Ended ${formatDay(membership.endedOn)}${membership.endReason ? ` · ${membership.endReason}` : ""}`
                            : `Since ${formatDay(membership.since)}`
                        }
                        detail={
                          <span className="flex flex-wrap gap-x-3 gap-y-1">
                            {teamFields(membership.team).map((field) => {
                              const value = membership.fields[field.key]
                              const text = Array.isArray(value) ? value.join(", ") : value
                              return (
                                <span key={field.key}>
                                  <span className="text-(--pn-fg-muted)">{field.label} </span>
                                  {text ? (
                                    <span className={field.mono ? "font-mono" : undefined}>{text}</span>
                                  ) : (
                                    <Unset />
                                  )}
                                </span>
                              )
                            })}
                          </span>
                        }
                      />
                    ))}
                  </Rows>
                </SectionCard>
              ) : null}

              <SectionCard title="Census history" padding="flush">
                {person.census.length === 0 ? (
                  <SectionEmpty title="Not expected in any campaign yet" />
                ) : (
                  <Rows>
                    {person.census.map((entry) => (
                      <Row
                        key={entry.year}
                        lead={<RowIcon icon={ClipboardList} />}
                        title={<span className="font-mono">{entry.year}</span>}
                        meta={
                          entry.answer && entry.source && entry.answeredOn
                            ? `${CENSUS_SOURCE[entry.source]} · ${formatDay(entry.answeredOn)}`
                            : entry.year === CURRENT_YEAR
                              ? `Open until 31 Oct 2026${entry.reminders ? ` · ${entry.reminders} reminder${entry.reminders === 1 ? "" : "s"} sent` : ""}`
                              : "No answer"
                        }
                        end={
                          <>
                            {entry.answer && canRead ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={buttonMotion}
                                onClick={() => {
                                  setAnswersYear(entry.year)
                                  setAnswersOpen(true)
                                }}
                              >
                                View answers
                              </Button>
                            ) : null}
                            <StateBadge state={entry.answer ? CENSUS_ANSWER[entry.answer] : NO_ANSWER} />
                          </>
                        }
                      />
                    ))}
                  </Rows>
                )}
              </SectionCard>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard
                title="Account"
                footer={
                  canWrite && account.status !== "review" ? (
                    <div className="flex flex-wrap gap-2">
                      {account.status === "none" && profile.personalEmail ? (
                        <Button
                          size="sm"
                          className={buttonMotion}
                          onClick={() => openAccount("invite", profile.personalEmail ?? "")}
                        >
                          <Mail data-icon="inline-start" />
                          Send invite
                        </Button>
                      ) : null}
                      {account.status === "invite" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={buttonMotion}
                          onClick={() => openAccount("resend", account.email)}
                        >
                          <RefreshCw data-icon="inline-start" />
                          Resend invite
                        </Button>
                      ) : null}
                      {account.status !== "linked" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={buttonMotion}
                          onClick={() => {
                            setLinkKey((key) => key + 1)
                            setLinkOpen(true)
                          }}
                        >
                          <Link2 data-icon="inline-start" />
                          Link account
                        </Button>
                      ) : null}
                      {account.status === "invite" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={buttonMotion}
                          onClick={() => openAccount("revoke", account.email)}
                        >
                          Revoke invite
                        </Button>
                      ) : null}
                      {account.status === "linked" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`${buttonMotion} text-(--pn-danger-fg)`}
                          onClick={() => openAccount("unlink", account.email)}
                        >
                          <Unlink data-icon="inline-start" />
                          Unlink
                        </Button>
                      ) : null}
                    </div>
                  ) : undefined
                }
              >
                {account.status === "none" ? (
                  <p className="text-[13px] text-(--pn-fg-muted)">
                    {profile.firstName} hasn't signed in. The record works without an account; linking lets them use My
                    area.
                  </p>
                ) : null}
                {account.status === "invite" ? (
                  <KeyValueList
                    items={[
                      {
                        key: "Invite sent to",
                        value: <span className="[overflow-wrap:anywhere]">{account.email}</span>,
                      },
                      { key: "Sent on", value: `${formatDay(account.sentOn)} by ${account.sentBy}` },
                      {
                        key: "Expires on",
                        value: isExpired(account.expiresOn) ? (
                          <StatusBadge tone="danger">Expired {formatDay(account.expiresOn)}</StatusBadge>
                        ) : (
                          formatDay(account.expiresOn)
                        ),
                      },
                    ]}
                  />
                ) : null}
                {account.status === "linked" ? (
                  <KeyValueList
                    items={[
                      {
                        key: "Sign-in",
                        value: <span className="[overflow-wrap:anywhere]">{account.email}</span>,
                        mono: true,
                      },
                      { key: "Signed in with", value: account.via },
                      { key: "Linked on", value: formatDay(account.linkedOn) },
                      { key: "How", value: account.how },
                    ]}
                  />
                ) : null}
                {account.status === "review" ? (
                  <InlineAlert
                    tone="warning"
                    action={
                      canWrite ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={buttonMotion}
                          nativeButton={false}
                          render={<Link to="/dashboard/people/linking" />}
                        >
                          Resolve
                        </Button>
                      ) : undefined
                    }
                  >
                    {account.issue}
                  </InlineAlert>
                ) : null}
              </SectionCard>

              {member ? (
                <SectionCard
                  title="Member"
                  action={
                    canWriteMembers ? (
                      <Menu>
                        <MenuTrigger
                          render={
                            <IconButton label="Member actions" ariaLabel="Member actions" icon={EllipsisVertical} />
                          }
                        />
                        <MenuContent>
                          <MenuItem onClick={() => openMember("status")}>
                            <Pencil />
                            Change status
                          </MenuItem>
                          <MenuItem onClick={() => openMember("number")}>
                            <IdCard />
                            Change member number
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    ) : undefined
                  }
                >
                  <KeyValueList
                    items={[
                      { key: "Member number", value: <MonoChip>{member.number}</MonoChip> },
                      { key: "Status", value: <StateBadge state={MEMBER_STATUS[member.status]} /> },
                      { key: "Admitted on", value: formatDay(member.admittedOn) },
                      {
                        key: `Fee ${CURRENT_YEAR}`,
                        value: member.fee ? <StateBadge state={FEE_STATUS[member.fee]} /> : null,
                      },
                      {
                        key: "Microsoft 365",
                        value: (
                          <Link
                            to="/dashboard/azure/members"
                            className="font-mono [overflow-wrap:anywhere] text-(--pn-accent) hover:underline"
                          >
                            {member.m365Email}
                          </Link>
                        ),
                      },
                    ]}
                  />
                </SectionCard>
              ) : null}

              <SectionCard title="Consents" padding="flush">
                {person.consents.privacy || person.consents.photo ? (
                  <Rows>
                    {person.consents.privacy ? (
                      <Row
                        lead={<RowIcon icon={FileText} />}
                        title="Volunteer privacy policy"
                        meta={`Version ${person.consents.privacy.version} · accepted ${formatDay(person.consents.privacy.acceptedOn)}`}
                        end={<StatusBadge tone="success">Accepted</StatusBadge>}
                      />
                    ) : null}
                    {person.consents.photo ? (
                      <Row
                        lead={<RowIcon icon={Camera} />}
                        title="Photo and video"
                        meta={`${person.consents.photo.status === "granted" ? "Granted" : person.consents.photo.status === "denied" ? "Denied" : "Revoked"} ${formatDay(person.consents.photo.on)} · revocable from My area`}
                        end={
                          <StatusBadge tone={person.consents.photo.status === "granted" ? "success" : "neutral"}>
                            {person.consents.photo.status === "granted"
                              ? "Granted"
                              : person.consents.photo.status === "denied"
                                ? "Denied"
                                : "Revoked"}
                          </StatusBadge>
                        }
                      />
                    ) : null}
                  </Rows>
                ) : (
                  <SectionEmpty title="No consents yet" hint="They're collected with the census." />
                )}
              </SectionCard>

              {canRead ? (
                <SectionCard
                  title="HR notes"
                  action={
                    canWrite ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={buttonMotion}
                        onClick={() => {
                          setNotesKey((key) => key + 1)
                          setNotesOpen(true)
                        }}
                      >
                        <NotebookPen data-icon="inline-start" />
                        {person.notes ? "Edit" : "Add note"}
                      </Button>
                    ) : undefined
                  }
                >
                  {person.notes ? (
                    <p className="text-[14px] whitespace-pre-line">{person.notes}</p>
                  ) : (
                    <p className="text-[13px] text-(--pn-fg-muted)">No notes.</p>
                  )}
                </SectionCard>
              ) : null}
            </div>
          </div>

          <SectionCard title="Activity" count={person.activity.length} padding="flush">
            {person.activity.length === 0 ? (
              <SectionEmpty title="No activity yet" />
            ) : (
              <Rows>
                {person.activity.map((entry) => (
                  <Row
                    key={`${entry.at}-${entry.text}`}
                    lead={<PersonAvatar name={entry.actor} size={24} />}
                    title={
                      <span className="font-normal">
                        <span className="font-medium">{entry.actor}</span> {entry.text}
                      </span>
                    }
                    meta={formatDateTime(new Date(entry.at))}
                  />
                ))}
              </Rows>
            )}
          </SectionCard>
        </div>
      </PageContent>

      {canWrite ? (
        <>
          <PersonDialog key={`edit-${editKey}`} open={editOpen} onOpenChange={setEditOpen} person={person} />
          <NotesDialog
            key={`notes-${notesKey}`}
            open={notesOpen}
            onOpenChange={setNotesOpen}
            personId={person.id}
            notes={person.notes}
          />
          <AccountActionDialog action={accountAction} open={accountOpen} onOpenChange={setAccountOpen} />
          <LinkAccountDialog
            key={`link-${linkKey}`}
            open={linkOpen}
            onOpenChange={setLinkOpen}
            person={{ id: person.id, name, firstName: profile.firstName }}
          />
        </>
      ) : null}
      {admin && adminDialog ? (
        adminDialog === "end" ? (
          <EndAdminDialog key={`end-${adminKey}`} open={adminOpen} onOpenChange={setAdminOpen} target={adminTarget} />
        ) : adminDialog === "capoRef" ? (
          <CapoOfReferenceDialog
            key={`ref-${adminKey}`}
            open={adminOpen}
            onOpenChange={setAdminOpen}
            target={adminTarget}
            current={admin.capoOfReference?.id ?? null}
          />
        ) : adminDialog === "capoScope" ? (
          <CapoScopeDialog
            key={`scope-${adminKey}`}
            open={adminOpen}
            onOpenChange={setAdminOpen}
            target={adminTarget}
            scope={admin.capoScope}
          />
        ) : (
          <EndCapoDialog
            key={`end-capo-${adminKey}`}
            open={adminOpen}
            onOpenChange={setAdminOpen}
            target={adminTarget}
            scope={admin.capoScope ?? ""}
          />
        )
      ) : null}
      {canWriteMembers && member && memberDialog ? (
        memberDialog === "status" ? (
          <MemberStatusDialog
            key={`status-${memberKey}`}
            open={memberOpen}
            onOpenChange={setMemberOpen}
            member={{ personId: person.id, name, ...member }}
          />
        ) : (
          <MemberNumberDialog
            key={`number-${memberKey}`}
            open={memberOpen}
            onOpenChange={setMemberOpen}
            member={{ personId: person.id, name, ...member }}
          />
        )
      ) : null}
      {canRead && answersYear ? (
        <CensusAnswersDialog
          key={answersYear}
          open={answersOpen}
          onOpenChange={setAnswersOpen}
          personId={person.id}
          name={name}
          year={answersYear}
        />
      ) : null}
    </>
  )
}
