import { Link } from "@tanstack/react-router"
import {
  Crown,
  History,
  Link2,
  Mail,
  NotebookPen,
  Pencil,
  RefreshCw,
  ShieldUser,
  Unlink,
  UserMinus,
  UserPlus,
  UserRoundCog,
  Users,
} from "lucide-react"

import {
  buttonMotion,
  Chip,
  InlineAlert,
  KeyValueList,
  type KeyValueItem,
  PlatformGlyph,
  RecordHeader,
  SectionCard,
  SectionEmpty,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"

import { type AccountAction, AccountActionDialog } from "./account-action-dialog"
import {
  AppointCapoDialog,
  AssignAdminDialog,
  CapoOfReferenceDialog,
  CapoScopeDialog,
  EndAdminDialog,
  EndCapoDialog,
} from "./admin-dialogs"
import { LinkAccountDialog, UnlinkAccountDialog } from "./link-account-dialog"
import { NotesDialog } from "./notes-dialog"
import {
  ACCOUNT_STATUS,
  actorName,
  assignmentLabel,
  currentAdmin,
  currentCapo,
  currentTeams,
  formatDay,
  hasNoRoles,
  isExpired,
  isTeamAssignment,
  LINK_METHOD,
  openAssignments,
  openRefusals,
  personName,
  roleLabels,
  teamName,
  type TeamAssignment,
  waitingForAuth,
} from "./people-format"
import { useDialog, useDialogState } from "./people-hooks"
import {
  ActionMenu,
  AssignmentBadge,
  type MenuAction,
  PersonAvatar,
  RefusalText,
  Row,
  RowIcon,
  Rows,
  StateBadge,
} from "./people-ui"
import {
  type Assignment,
  type PersonRecord,
  type PersonRow,
  TEAM_IDS,
  teamFields,
  type TeamSummary,
} from "./people.contract"
import { PersonDialog } from "./person-dialog"
import { AddToTeamDialog, EditTeamFieldsDialog, EndTeamMembershipDialog, type TeamMemberTarget } from "./team-dialogs"

type RoleDialog =
  | { kind: "assignAdmin" | "endAdmin" | "capoRef" | "appointCapo" | "capoScope" | "endCapo" }
  | { kind: "teamFields" | "endTeam"; target: TeamMemberTarget }

const BACK = { label: "people", link: { to: "/dashboard/people" } } as const

const KIND_ICON = { admin: ShieldUser, capo: Crown, team: Users }

/** "Since 6 Oct 2026", or when and why it ended. */
function assignmentMeta(assignment: Assignment) {
  // A start Auth refused never took effect: its end date and reason only repeat the refusal.
  if (assignment.status === "refused" && assignment.change === "start") return `Assigned ${formatDay(assignment.since)}`
  const parts = [
    assignment.endedOn && assignment.status !== "sent"
      ? `${formatDay(assignment.since)} – ${formatDay(assignment.endedOn)}`
      : `Since ${formatDay(assignment.since)}`,
  ]
  if (assignment.endReason) parts.push(assignment.endReason)
  return parts.join(" · ")
}

function TeamFieldValues({ assignment }: { assignment: TeamAssignment }) {
  const fields = teamFields(assignment.team)
  if (!fields.length) return null
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {fields.map((field) => {
        const value = assignment.fields[field.key]
        const text = Array.isArray(value) ? value.join(", ") : value
        return (
          <span key={field.key}>
            <span className="text-(--pn-fg-muted)">{field.label} </span>
            {text ? <span className={field.mono ? "font-mono" : undefined}>{text}</span> : <Unset />}
          </span>
        )
      })}
    </span>
  )
}

/** People › {name}: the record, each role and where it stands with Auth, the account, and the history. */
export function PersonPage({
  person,
  people,
  teams: teamSummaries,
}: {
  person: PersonRecord
  people: readonly PersonRow[]
  teams: readonly TeamSummary[]
}) {
  const canWrite = useCan("people:write")
  const canRead = useCan("people:read")
  const canAppoint = useCan("people:appoint")
  const canLink = useCan("people:link")
  const name = personName(person)
  const linked = person.account.status === "linked"
  const archived = hasNoRoles(person)
  const roles = roleLabels(person)
  const admin = currentAdmin(person)
  const capo = currentCapo(person)
  const teams = currentTeams(person)
  const open = openAssignments(person)
  const openIds = new Set(open.map((assignment) => assignment.id))
  const history = person.assignments.filter((assignment) => !openIds.has(assignment.id))
  const refusals = openRefusals(person)
  const waiting = waitingForAuth(person)
  const pending = person.assignments.some((a) => a.endedOn === null && a.status === "pending")
  const target = { personId: person.id, name }
  const option = { id: person.id, name, linked }
  const { account } = person

  const edit = useDialogState()
  const notes = useDialogState()
  const link = useDialogState()
  const unlink = useDialogState()
  const addTeam = useDialogState()
  const accountDialog = useDialog<AccountAction>()
  const roleDialog = useDialog<RoleDialog>()

  function teamTarget(assignment: TeamAssignment): TeamMemberTarget {
    return { personId: person.id, name, team: assignment.team, fields: assignment.fields, linked }
  }

  /** The actions on one current role. Nothing while a change waits for Auth: the backend would refuse it. */
  function roleActions(assignment: Assignment): (MenuAction | false)[] {
    if (assignment.endedOn !== null || waiting) return []
    if (assignment.kind === "admin")
      return [
        canWrite && {
          label: "Capo Admin of reference",
          icon: UserRoundCog,
          onClick: () => roleDialog.show({ kind: "capoRef" }),
        },
        canAppoint &&
          !capo && {
            label: "Appoint as Capo Admin",
            icon: Crown,
            onClick: () => roleDialog.show({ kind: "appointCapo" }),
          },
        // The backend ends the Capo Admin role first: offering it here would only fail.
        canWrite &&
          !capo && {
            label: "End admin role",
            icon: UserMinus,
            destructive: true,
            onClick: () => roleDialog.show({ kind: "endAdmin" }),
          },
      ]
    if (assignment.kind === "capo")
      return [
        canAppoint && { label: "Change scope", icon: Pencil, onClick: () => roleDialog.show({ kind: "capoScope" }) },
        canAppoint && {
          label: "End Capo Admin role",
          icon: Crown,
          destructive: true,
          onClick: () => roleDialog.show({ kind: "endCapo" }),
        },
      ]
    if (!isTeamAssignment(assignment)) return []
    return [
      canWrite && {
        label: "Edit team fields",
        ariaLabel: `Edit the ${teamName(assignment.team)} team fields`,
        icon: Pencil,
        onClick: () => roleDialog.show({ kind: "teamFields", target: teamTarget(assignment) }),
      },
      (assignment.teamRole === "lead" ? canAppoint : canWrite) && {
        label: "End membership",
        ariaLabel: `End the ${teamName(assignment.team)} membership`,
        icon: UserMinus,
        destructive: true,
        onClick: () => roleDialog.show({ kind: "endTeam", target: teamTarget(assignment) }),
      },
    ]
  }

  function openAccount(kind: AccountAction["kind"], email: string) {
    accountDialog.show({ kind, personId: person.id, name, email })
  }

  const addActions: (MenuAction | false)[] = waiting
    ? []
    : [
        canWrite &&
          !admin && { label: "Make admin", icon: ShieldUser, onClick: () => roleDialog.show({ kind: "assignAdmin" }) },
        canAppoint &&
          admin !== null &&
          !capo && {
            label: "Appoint as Capo Admin",
            icon: Crown,
            onClick: () => roleDialog.show({ kind: "appointCapo" }),
          },
        canWrite && teams.length < TEAM_IDS.length && { label: "Add to team", icon: UserPlus, onClick: addTeam.show },
      ]

  const contactItems: KeyValueItem[] = [
    {
      key: "Contact email",
      value: person.contactEmail ? <span className="[overflow-wrap:anywhere]">{person.contactEmail}</span> : null,
    },
    { key: "Phone", value: person.phone },
    {
      key: "Telegram",
      value: person.telegramUsername ? (
        <span className="inline-flex items-center gap-1.5">
          <PlatformGlyph platform="tg" className="size-3.5" />
          <span className="font-mono">@{person.telegramUsername}</span>
        </span>
      ) : null,
    },
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
            meta={<span className="font-mono">{person.id}</span>}
            chips={roles.length ? roles.map((role) => <Chip key={role}>{role}</Chip>) : undefined}
          />

          {refusals.length || waiting || (pending && !linked) || archived ? (
            <div className="flex flex-col gap-2">
              {refusals.map((assignment) => (
                <InlineAlert key={assignment.id} tone="danger">
                  PoliNetwork Auth refused to {assignment.change === "start" ? "give" : "take back"} the{" "}
                  {assignmentLabel(assignment)} role: {assignment.refusal ?? "no reason given"}.
                  {assignment.change === "start" ? " Someone with clearance can assign it again." : ""}
                </InlineAlert>
              ))}
              {waiting ? (
                <InlineAlert tone="info">
                  A role change is waiting for PoliNetwork Auth. Other role changes for {person.firstName} wait until it
                  answers.
                </InlineAlert>
              ) : null}
              {pending && !linked ? (
                <InlineAlert tone="neutral">
                  {person.firstName}'s roles wait until the record is linked to an account: send an invite, or link one
                  by hand.
                </InlineAlert>
              ) : null}
              {archived && !refusals.length ? (
                <InlineAlert tone="neutral">No current roles. The record stays for history.</InlineAlert>
              ) : null}
            </div>
          ) : null}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard
                title="Roles"
                count={open.length}
                padding="flush"
                action={<ActionMenu label="Add a role" actions={addActions} />}
              >
                {open.length === 0 ? <SectionEmpty title="No roles" /> : null}
                <Rows>
                  {open.map((assignment) => (
                    <Row
                      key={assignment.id}
                      lead={<RowIcon icon={KIND_ICON[assignment.kind]} />}
                      title={
                        isTeamAssignment(assignment) ? (
                          <>
                            <Link
                              to="/dashboard/people/teams/$teamId"
                              params={{ teamId: assignment.team }}
                              className="hover:text-(--pn-accent)"
                            >
                              {teamName(assignment.team)}
                            </Link>
                            <Chip>{assignment.teamRole === "lead" ? "Lead" : "Member"}</Chip>
                          </>
                        ) : (
                          assignmentLabel(assignment)
                        )
                      }
                      meta={
                        <>
                          {assignmentMeta(assignment)}
                          {assignment.kind === "admin" ? (
                            <>
                              {" · Capo Admin: "}
                              {assignment.capoOfReference ? (
                                <Link
                                  to="/dashboard/people/$personId"
                                  params={{ personId: assignment.capoOfReference.id }}
                                  className="text-(--pn-accent) hover:underline"
                                >
                                  {assignment.capoOfReference.name}
                                </Link>
                              ) : (
                                "none"
                              )}
                            </>
                          ) : null}
                        </>
                      }
                      detail={
                        isTeamAssignment(assignment) || assignment.refusal ? (
                          <span className="flex flex-col gap-1">
                            {isTeamAssignment(assignment) ? <TeamFieldValues assignment={assignment} /> : null}
                            {assignment.status === "refused" ? <RefusalText refusal={assignment.refusal} /> : null}
                          </span>
                        ) : undefined
                      }
                      end={
                        <>
                          <AssignmentBadge assignment={assignment} showApplied />
                          <ActionMenu
                            label={`${assignmentLabel(assignment)} actions`}
                            actions={roleActions(assignment)}
                          />
                        </>
                      }
                    />
                  ))}
                </Rows>
              </SectionCard>

              <SectionCard
                title="Contacts"
                action={
                  canWrite ? (
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={edit.show}>
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                  ) : undefined
                }
              >
                <KeyValueList items={contactItems} />
              </SectionCard>

              {history.length ? (
                <SectionCard title="Past roles" count={history.length} padding="flush">
                  <Rows>
                    {history.map((assignment) => (
                      <Row
                        key={assignment.id}
                        lead={<RowIcon icon={History} />}
                        title={<span className="text-(--pn-fg-muted)">{assignmentLabel(assignment)}</span>}
                        meta={assignmentMeta(assignment)}
                        detail={
                          assignment.status === "refused" ? <RefusalText refusal={assignment.refusal} /> : undefined
                        }
                        end={assignment.status === "refused" ? <AssignmentBadge assignment={assignment} /> : undefined}
                      />
                    ))}
                  </Rows>
                </SectionCard>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard
                title="Account"
                footer={
                  canWrite || canLink ? (
                    <div className="flex flex-wrap gap-2">
                      {canWrite && account.status === "none" && person.contactEmail ? (
                        <Button
                          size="sm"
                          className={buttonMotion}
                          onClick={() => openAccount("invite", person.contactEmail ?? "")}
                        >
                          <Mail data-icon="inline-start" />
                          Send invite
                        </Button>
                      ) : null}
                      {canWrite && account.status === "invite" ? (
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
                      {canLink && account.status !== "linked" ? (
                        <Button size="sm" variant="outline" className={buttonMotion} onClick={link.show}>
                          <Link2 data-icon="inline-start" />
                          Link account
                        </Button>
                      ) : null}
                      {canWrite && account.status === "invite" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={buttonMotion}
                          onClick={() => openAccount("revoke", account.email)}
                        >
                          Revoke invite
                        </Button>
                      ) : null}
                      {canLink && account.status === "linked" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className={`${buttonMotion} text-(--pn-danger-fg)`}
                          disabled={waiting}
                          onClick={unlink.show}
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
                    No account linked. {person.firstName}'s roles wait here until {person.firstName} accepts an invite,
                    signing in with any account, or someone links one by hand.
                    {person.contactEmail ? "" : " Add a contact email to send an invite."}
                  </p>
                ) : null}
                {account.status === "invite" ? (
                  <KeyValueList
                    items={[
                      {
                        key: "Invite sent to",
                        value: <span className="[overflow-wrap:anywhere]">{account.email}</span>,
                      },
                      { key: "Sent on", value: `${formatDay(account.sentOn)} by ${actorName(account.sentBy, people)}` },
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
                        key: "Account",
                        value: <span className="[overflow-wrap:anywhere]">{account.sub}</span>,
                        mono: true,
                      },
                      { key: "How", value: LINK_METHOD[account.method] },
                      { key: "Linked on", value: account.linkedOn ? formatDay(account.linkedOn) : null },
                      { key: "Linked by", value: account.linkedBy ? actorName(account.linkedBy, people) : null },
                    ]}
                  />
                ) : null}
              </SectionCard>

              {canRead ? (
                <SectionCard
                  title="HR notes"
                  action={
                    canWrite ? (
                      <Button size="sm" variant="ghost" className={buttonMotion} onClick={notes.show}>
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
                {person.activity.map((entry) => {
                  const actor = actorName(entry.actor, people)
                  return (
                    <Row
                      key={`${entry.at}-${entry.text}`}
                      lead={<PersonAvatar name={actor} size={24} />}
                      title={
                        <span className="font-normal [overflow-wrap:anywhere]">
                          <span className="font-medium">{actor}</span> {entry.text}
                        </span>
                      }
                      meta={formatDateTime(new Date(entry.at))}
                    />
                  )
                })}
              </Rows>
            )}
          </SectionCard>
        </div>
      </PageContent>

      {canWrite ? (
        <>
          <PersonDialog key={`edit-${edit.key}`} open={edit.open} onOpenChange={edit.onOpenChange} person={person} />
          <NotesDialog
            key={`notes-${notes.key}`}
            open={notes.open}
            onOpenChange={notes.onOpenChange}
            personId={person.id}
            notes={person.notes}
          />
          <AccountActionDialog
            action={accountDialog.target}
            open={accountDialog.open}
            onOpenChange={accountDialog.onOpenChange}
          />
          <AddToTeamDialog
            key={`add-team-${addTeam.key}`}
            open={addTeam.open}
            onOpenChange={addTeam.onOpenChange}
            teams={TEAM_IDS.filter((team) => !teams.some((assignment) => assignment.team === team))}
            availability={teamSummaries}
            person={option}
            canAppoint={canAppoint}
          />
        </>
      ) : null}
      {canLink ? (
        <>
          <LinkAccountDialog
            key={`link-${link.key}`}
            open={link.open}
            onOpenChange={link.onOpenChange}
            person={{ id: person.id, name, firstName: person.firstName }}
          />
          <UnlinkAccountDialog
            key={`unlink-${unlink.key}`}
            open={unlink.open}
            onOpenChange={unlink.onOpenChange}
            person={{ id: person.id, name, roles: roles.length }}
          />
        </>
      ) : null}
      {roleDialog.target ? <RoleDialogs dialog={roleDialog} person={person} option={option} target={target} /> : null}
    </>
  )
}

/** The dialog of the role action that was chosen. */
function RoleDialogs({
  dialog,
  person,
  option,
  target,
}: {
  dialog: ReturnType<typeof useDialog<RoleDialog>>
  person: PersonRecord
  option: { id: string; name: string; linked: boolean }
  target: { personId: string; name: string }
}) {
  const state = { open: dialog.open, onOpenChange: dialog.onOpenChange }
  const choice = dialog.target
  if (!choice) return null
  const admin = currentAdmin(person)
  const capo = currentCapo(person)
  switch (choice.kind) {
    case "assignAdmin":
      return <AssignAdminDialog key={`assign-${dialog.key}`} {...state} person={option} />
    case "endAdmin":
      return <EndAdminDialog key={`end-${dialog.key}`} {...state} target={target} linked={option.linked} />
    case "capoRef":
      return (
        <CapoOfReferenceDialog
          key={`ref-${dialog.key}`}
          {...state}
          target={target}
          current={admin?.capoOfReference?.id ?? null}
        />
      )
    case "appointCapo":
      return <AppointCapoDialog key={`appoint-${dialog.key}`} {...state} person={option} />
    case "capoScope":
      return <CapoScopeDialog key={`scope-${dialog.key}`} {...state} target={target} scope={capo?.capoScope ?? ""} />
    case "endCapo":
      return (
        <EndCapoDialog
          key={`end-capo-${dialog.key}`}
          {...state}
          target={target}
          linked={option.linked}
          scope={capo?.capoScope ?? ""}
        />
      )
    case "teamFields":
      return <EditTeamFieldsDialog key={`fields-${dialog.key}`} {...state} target={choice.target} />
    case "endTeam":
      return <EndTeamMembershipDialog key={`end-team-${dialog.key}`} {...state} target={choice.target} />
  }
}
