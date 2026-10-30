import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Camera,
  Crown,
  FileText,
  Link2,
  Mail,
  NotebookPen,
  Pencil,
  RefreshCw,
  Unlink,
  UserMinus,
  UserPlus,
  UserRoundCog,
  Users,
} from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  Chip,
  InlineAlert,
  KeyValueList,
  type KeyValueItem,
  LoadingButton,
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
import { LinkAccountDialog } from "./link-account-dialog"
import { NotesDialog } from "./notes-dialog"
import {
  ACCOUNT_STATUS,
  activeTeams,
  formatDay,
  hasNoRoles,
  isExpired,
  personName,
  PHOTO_CONSENT,
  roleLabels,
  teamName,
  yearOf,
} from "./people-format"
import { errorMessage, useDialog, useDialogState, useRefreshAfter } from "./people-hooks"
import { ActionMenu, PersonAvatar, Row, RowIcon, Rows, StateBadge } from "./people-ui"
import { updatePerson } from "./people-write.functions"
import { type PersonRecord, TEAM_IDS, type TeamMembership, teamFields } from "./people.contract"
import { PersonDialog } from "./person-dialog"
import { AddToTeamDialog, EditTeamFieldsDialog, EndTeamMembershipDialog, type TeamMemberTarget } from "./team-dialogs"

type AdminDialogKind = "end" | "capoRef" | "capoScope" | "endCapo"

const BACK = { label: "people", link: { to: "/dashboard/people" } } as const

/** People › {name}: the whole record, its discrepancies and its history. */
export function PersonPage({ person }: { person: PersonRecord }) {
  const canWrite = useCan("people:write")
  const canRead = useCan("people:read")
  const canAppoint = useCan("people:appoint")
  const update = useServerFn(updatePerson)
  const refresh = useRefreshAfter()
  const name = personName(person)
  const archived = hasNoRoles(person)
  const roles = roleLabels(person)
  const { profile, admin, account } = person
  const adminTarget = { personId: person.id, name }

  const edit = useDialogState()
  const notes = useDialogState()
  const link = useDialogState()
  const addTeam = useDialogState()
  const accountDialog = useDialog<AccountAction>()
  const adminDialog = useDialog<AdminDialogKind>()
  const teamDialog = useDialog<{ kind: "fields" | "end"; target: TeamMemberTarget }>()
  const [applyingTelegram, setApplyingTelegram] = useState(false)

  function openTeam(kind: "fields" | "end", membership: TeamMembership) {
    teamDialog.show({ kind, target: { personId: person.id, name, team: membership.team, fields: membership.fields } })
  }

  function openAccount(kind: AccountAction["kind"], email: string) {
    accountDialog.show({ kind, personId: person.id, name, email })
  }

  async function applyCensusTelegram(username: string) {
    setApplyingTelegram(true)
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
      appToast.error(errorMessage(caught, "Couldn't update the Telegram username."))
      return
    } finally {
      setApplyingTelegram(false)
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
                  No active roles left. The record stays for history; it no longer appears in team or admin lists.
                </InlineAlert>
              ) : null}
              {person.discrepancies.map((discrepancy, index) => (
                <InlineAlert
                  key={`${discrepancy.kind}-${index}`}
                  tone="warning"
                  action={
                    // The update resends the whole profile: an unknown stored year would be replaced, so edit instead.
                    discrepancy.kind === "telegram-mismatch" &&
                    discrepancy.suggestedTelegram &&
                    canWrite &&
                    yearOf(profile.year) === profile.year ? (
                      <LoadingButton
                        size="sm"
                        variant="ghost"
                        pending={applyingTelegram}
                        onClick={() => void applyCensusTelegram(discrepancy.suggestedTelegram ?? "")}
                      >
                        Use @{discrepancy.suggestedTelegram}
                      </LoadingButton>
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
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={edit.show}>
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
                    admin.status === "active" ? (
                      <ActionMenu
                        label="Admin actions"
                        actions={[
                          canWrite &&
                            !admin.capoScope && {
                              label: "Capo Admin of reference",
                              icon: UserRoundCog,
                              onClick: () => adminDialog.show("capoRef"),
                            },
                          canAppoint && {
                            label: admin.capoScope ? "Change Capo Admin scope" : "Appoint as Capo Admin",
                            icon: Crown,
                            onClick: () => adminDialog.show("capoScope"),
                          },
                          canAppoint &&
                            admin.capoScope !== null && {
                              label: "End Capo Admin role",
                              icon: Crown,
                              destructive: true,
                              onClick: () => adminDialog.show("endCapo"),
                            },
                          // Ending a Capo Admin's admin role also ends the scope, which takes people:appoint.
                          canWrite &&
                            (canAppoint || !admin.capoScope) && {
                              label: "End admin role",
                              icon: UserMinus,
                              destructive: true,
                              onClick: () => adminDialog.show("end"),
                            },
                        ]}
                      />
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
                </SectionCard>
              ) : null}

              {person.teams.length || canWrite ? (
                <SectionCard
                  title="Teams"
                  padding="flush"
                  action={
                    canWrite ? (
                      <Button variant="ghost" size="sm" className={buttonMotion} onClick={addTeam.show}>
                        <UserPlus data-icon="inline-start" />
                        Add to team
                      </Button>
                    ) : undefined
                  }
                >
                  {person.teams.length === 0 ? <SectionEmpty title="Not in any team" /> : null}
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
                        end={
                          canWrite && !membership.endedOn ? (
                            <ActionMenu
                              label={`${teamName(membership.team)} actions`}
                              actions={[
                                {
                                  label: "Edit team fields",
                                  ariaLabel: `Edit the ${teamName(membership.team)} team fields`,
                                  icon: Pencil,
                                  onClick: () => openTeam("fields", membership),
                                },
                                (membership.role !== "lead" || canAppoint) && {
                                  label: "End membership",
                                  ariaLabel: `End the ${teamName(membership.team)} membership`,
                                  icon: UserMinus,
                                  destructive: true,
                                  onClick: () => openTeam("end", membership),
                                },
                              ]}
                            />
                          ) : undefined
                        }
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
                  canWrite ? (
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
                        <Button size="sm" variant="outline" className={buttonMotion} onClick={link.show}>
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
              </SectionCard>

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
                        meta={`${PHOTO_CONSENT[person.consents.photo.status].label} ${formatDay(person.consents.photo.on)}`}
                        end={<StateBadge state={PHOTO_CONSENT[person.consents.photo.status]} />}
                      />
                    ) : null}
                  </Rows>
                ) : (
                  <SectionEmpty title="No consents yet" />
                )}
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
          <LinkAccountDialog
            key={`link-${link.key}`}
            open={link.open}
            onOpenChange={link.onOpenChange}
            person={{ id: person.id, name, firstName: profile.firstName }}
          />
          <AddToTeamDialog
            key={`add-team-${addTeam.key}`}
            open={addTeam.open}
            onOpenChange={addTeam.onOpenChange}
            teams={TEAM_IDS.filter((team) => !activeTeams(person).some((membership) => membership.team === team))}
            person={{ id: person.id, name }}
            canAppoint={canAppoint}
          />
        </>
      ) : null}
      {teamDialog.target ? (
        teamDialog.target.kind === "fields" ? (
          <EditTeamFieldsDialog
            key={`fields-${teamDialog.key}`}
            open={teamDialog.open}
            onOpenChange={teamDialog.onOpenChange}
            target={teamDialog.target.target}
          />
        ) : (
          <EndTeamMembershipDialog
            key={`end-team-${teamDialog.key}`}
            open={teamDialog.open}
            onOpenChange={teamDialog.onOpenChange}
            target={teamDialog.target.target}
          />
        )
      ) : null}
      {admin && adminDialog.target ? (
        adminDialog.target === "end" ? (
          <EndAdminDialog
            key={`end-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            target={adminTarget}
          />
        ) : adminDialog.target === "capoRef" ? (
          <CapoOfReferenceDialog
            key={`ref-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            target={adminTarget}
            current={admin.capoOfReference?.id ?? null}
          />
        ) : adminDialog.target === "capoScope" ? (
          <CapoScopeDialog
            key={`scope-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            target={adminTarget}
            scope={admin.capoScope}
          />
        ) : (
          <EndCapoDialog
            key={`end-capo-${adminDialog.key}`}
            open={adminDialog.open}
            onOpenChange={adminDialog.onOpenChange}
            target={adminTarget}
            scope={admin.capoScope ?? ""}
          />
        )
      ) : null}
    </>
  )
}
