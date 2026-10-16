import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Camera,
  ChevronRight,
  CircleCheck,
  Crown,
  FileText,
  IdCard,
  Inbox,
  Mail,
  Pencil,
  Send,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  Chip,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  FormField,
  IconButton,
  InlineAlert,
  KeyValueList,
  type KeyValueItem,
  PlatformGlyph,
  SectionCard,
  SectionHeading,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { AskToBeAddedDialog, CorrectionDialog, LeavingDialog } from "./my-area-dialogs"
import { MyFeeCard } from "./my-fee-card"
import {
  activeTeams,
  CENSUS_ANSWER,
  CENSUS_SOURCE,
  FEE_STATUS,
  formatDay,
  isActiveAdmin,
  MEMBER_STATUS,
  nextYear,
  personName,
  teamName,
  telegramUrl,
  yearOf,
} from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { answerMyCensus, confirmMyMatch, rejectMyMatch, revokePhotoConsent } from "./people-self.functions"
import {
  ChoiceChips,
  MonoChip,
  PersonAvatar,
  PersonCell,
  Row,
  RowIcon,
  Rows,
  SelectField,
  StateBadge,
} from "./people-ui"
import { CAMPUSES, type Campus, COURSES, type MyArea, type TeamId, YEARS } from "./people.contract"

type Linked = Extract<MyArea, { state: "linked" }>
type Match = Extract<MyArea, { state: "match" }>
type Year = (typeof YEARS)[number]

/** Account › My area: what the signed-in person's record says, and the yearly census. */
export function MyAreaPage({ area }: { area: MyArea }) {
  if (area.state === "match") return <MatchView area={area} />
  if (area.state === "none") return <NoRecordView sentOn={area.request?.sentOn ?? null} />
  return <LinkedView area={area} />
}

function MatchView({ area }: { area: Match }) {
  const confirm = useServerFn(confirmMyMatch)
  const reject = useServerFn(rejectMyMatch)
  const refresh = useRefreshAfter()
  const [pending, setPending] = useState<"yes" | "no" | null>(null)
  const { candidate } = area

  async function decide(yes: boolean) {
    setPending(yes ? "yes" : "no")
    try {
      await (yes ? confirm : reject)()
    } catch (caught) {
      console.error(caught)
      const fallback = "That didn't work. Try again."
      appToast.error(caught instanceof Error ? errorMessage(caught, fallback) : fallback)
      setPending(null)
      return
    }
    await refresh(yes ? "Account linked." : "HR will check your sign-in.")
    setPending(null)
  }

  return (
    <>
      <PageBar title="Welcome" width="settings" />
      <PageContent width="settings">
        <SectionCard
          title="Is this you?"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                className={buttonMotion}
                disabled={pending !== null}
                onClick={() => decide(false)}
              >
                This isn't me
              </Button>
              <Button className={buttonMotion} disabled={pending !== null} onClick={() => decide(true)}>
                Yes, link my account
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-(--pn-fg-muted)">
              We found a record that matches your sign-in. Linking it shows your roles here and lets you answer the
              census.
            </p>
            <div className="flex items-start gap-3 rounded-(--pn-r-4) border border-(--pn-line) p-3">
              <PersonAvatar name={candidate.name} size={40} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{candidate.name}</span>
                <span className="text-[13px] text-(--pn-fg-muted)">
                  <span className="font-mono">{candidate.id}</span> · {candidate.course} · {candidate.year} ·{" "}
                  {candidate.campus}
                </span>
                {candidate.roles.length ? (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {candidate.roles.map((role) => (
                      <Chip key={role}>{role}</Chip>
                    ))}
                  </span>
                ) : null}
              </div>
            </div>
            <InlineAlert tone="info">{area.reason}</InlineAlert>
          </div>
        </SectionCard>
      </PageContent>
    </>
  )
}

function NoRecordView({ sentOn }: { sentOn: string | null }) {
  const [askOpen, setAskOpen] = useState(false)
  const [askKey, setAskKey] = useState(0)
  return (
    <>
      <PageBar width="settings" />
      <PageContent width="settings">
        {sentOn ? (
          <EmptyState
            icon={Inbox}
            title="Request sent"
            text={`HR will add you or link you to your record. You asked on ${formatDay(sentOn)}; you'll get an email when it's done.`}
            action={<StatusBadge tone="brand">Waiting for HR</StatusBadge>}
          />
        ) : (
          <EmptyState
            icon={UserRound}
            title="You're not on the volunteer or member lists"
            text="If you administer groups, belong to a team or are a member, ask to be added. HR matches your sign-in to your record."
            action={
              <Button
                className={buttonMotion}
                onClick={() => {
                  setAskKey((value) => value + 1)
                  setAskOpen(true)
                }}
              >
                <UserPlus data-icon="inline-start" />
                Ask to be added
              </Button>
            }
          />
        )}
      </PageContent>
      <AskToBeAddedDialog key={`ask-${askKey}`} open={askOpen} onOpenChange={setAskOpen} />
    </>
  )
}

/** This year's census: pre-filled from the record with the year advanced, then Confirm or I'm leaving. */
function CensusCard({ area }: { area: Linked }) {
  const { person, campaign } = area
  const save = useServerFn(answerMyCensus)
  const refresh = useRefreshAfter()
  const entry = campaign ? person.census.find((candidate) => candidate.year === campaign.year) : undefined
  const [editing, setEditing] = useState(false)
  const groups = isActiveAdmin(person) ? (person.admin?.groups.map((group) => group.title) ?? []) : []
  const teams = activeTeams(person).map((membership) => membership.team)
  const [course, setCourse] = useState(person.profile.course)
  // A first answer advances last year's year; changing an answer starts from the one already given.
  const answered = !!entry?.answer
  const [year, setYear] = useState<Year>(answered ? yearOf(person.profile.year) : nextYear(person.profile.year))
  const [campus, setCampus] = useState<Campus>(person.profile.campus)
  const [keepGroups, setKeepGroups] = useState(groups)
  const [keepTeams, setKeepTeams] = useState<TeamId[]>(teams)
  const [saving, setSaving] = useState(false)
  const [leavingOpen, setLeavingOpen] = useState(false)
  const [leavingKey, setLeavingKey] = useState(0)

  if (!campaign) return null
  const answer = { course, year, campus, keepGroups, keepTeams }

  if (entry?.answer && !editing) {
    return (
      <SectionCard padding="flush">
        <Rows>
          <Row
            lead={<RowIcon icon={entry.answer === "continues" ? CircleCheck : UserMinus} />}
            title={
              <>
                {entry.answer === "continues"
                  ? `You're confirmed for ${campaign.year}`
                  : `You told us you're leaving in ${campaign.year}`}
                <StateBadge state={CENSUS_ANSWER[entry.answer]} />
              </>
            }
            meta={`Answered ${entry.answeredOn ? formatDay(entry.answeredOn) : ""}${entry.source ? ` · ${CENSUS_SOURCE[entry.source]}` : ""}`}
            end={
              <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setEditing(true)}>
                Change answer
              </Button>
            }
          />
        </Rows>
      </SectionCard>
    )
  }

  async function confirmContinuing() {
    setSaving(true)
    try {
      await save({ data: { ...answer, answer: "continues", reason: "", note: "" } })
    } catch (caught) {
      console.error(caught)
      const fallback = "Your answer couldn't be saved. Try again."
      appToast.error(caught instanceof Error ? errorMessage(caught, fallback) : fallback)
      setSaving(false)
      return
    }
    await refresh(`Confirmed for ${campaign?.year ?? "this year"}.`)
    setSaving(false)
    setEditing(false)
  }

  const courses = COURSES.some((option) => option === person.profile.course)
    ? COURSES
    : [person.profile.course, ...COURSES]

  return (
    <SectionCard
      title={`${campaign.year} census`}
      action={<span className="text-[13px] text-(--pn-fg-muted)">Closes {formatDay(campaign.closesOn)}</span>}
      footer={
        // Phones stack the buttons full width with Confirm on top, like dialog footers.
        <div className="flex flex-col-reverse gap-2 shell:flex-row shell:flex-wrap shell:justify-end">
          {editing ? (
            <Button variant="ghost" className={buttonMotion} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          ) : null}
          <Button
            variant="outline"
            className={buttonMotion}
            disabled={saving}
            onClick={() => {
              setLeavingKey((value) => value + 1)
              setLeavingOpen(true)
            }}
          >
            I'm leaving
          </Button>
          <Button className={buttonMotion} disabled={saving} onClick={confirmContinuing}>
            Confirm for {campaign.year}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-(--pn-fg-muted)">
          Tell us whether you're staying on. We filled in last year's answers: check them and confirm.
        </p>
        <div className="grid grid-cols-1 gap-4 shell:grid-cols-3">
          <FormField label="Course" htmlFor="census-course">
            <SelectField
              id="census-course"
              value={course}
              options={courses.map((option) => ({ value: option, label: option }))}
              onChange={setCourse}
            />
          </FormField>
          <FormField
            label={`Year in ${campaign.year}`}
            htmlFor="census-year"
            hint={answered ? undefined : `You were in ${person.profile.year} last year.`}
          >
            <SelectField<Year>
              id="census-year"
              value={year}
              options={YEARS.map((option) => ({ value: option, label: option }))}
              onChange={setYear}
            />
          </FormField>
          <FormField label="Campus" htmlFor="census-campus">
            <SelectField<Campus>
              id="census-campus"
              value={campus}
              options={CAMPUSES.map((option) => ({ value: option, label: option }))}
              onChange={setCampus}
            />
          </FormField>
        </div>
        {groups.length ? (
          <FormField
            label="Groups you'll keep administering"
            htmlFor="census-groups"
            hint="Groups you deselect are handed to your Capo Admin."
          >
            <ChoiceChips
              id="census-groups"
              label="Groups you'll keep administering"
              options={groups}
              value={keepGroups}
              onChange={setKeepGroups}
            />
          </FormField>
        ) : null}
        {teams.length ? (
          <FormField label="Teams you're continuing with" htmlFor="census-teams">
            <ChoiceChips
              id="census-teams"
              label="Teams you're continuing with"
              options={teams.map(teamName)}
              value={keepTeams.map(teamName)}
              onChange={(names) => setKeepTeams(teams.filter((team) => names.includes(teamName(team))))}
            />
          </FormField>
        ) : null}
      </div>
      <LeavingDialog
        key={`leaving-${leavingKey}`}
        open={leavingOpen}
        onOpenChange={(open) => {
          setLeavingOpen(open)
          if (!open) setEditing(false)
        }}
        year={campaign.year}
        answer={answer}
      />
    </SectionCard>
  )
}

function LinkedView({ area }: { area: Linked }) {
  const { person, contacts, roster } = area
  const revoke = useServerFn(revokePhotoConsent)
  const refresh = useRefreshAfter()
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionKey, setCorrectionKey] = useState(0)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const { profile, member, admin, consents } = person
  const teams = activeTeams(person)
  const name = personName(person)

  const profileItems: KeyValueItem[] = [
    {
      key: "Personal email",
      value: profile.personalEmail ? <span className="[overflow-wrap:anywhere]">{profile.personalEmail}</span> : null,
    },
    { key: "Phone", value: profile.phone },
    {
      key: "Telegram",
      value: profile.telegramUsername ? (
        <span className="inline-flex items-center gap-1.5 font-mono">
          <PlatformGlyph platform="tg" className="size-3.5" />@{profile.telegramUsername}
        </span>
      ) : null,
    },
    { key: "Course", value: profile.course },
    { key: "Year", value: profile.year },
    { key: "Campus", value: <Chip>{profile.campus}</Chip> },
    ...(member || person.account.status === "linked"
      ? [
          {
            key: "PoliNetwork account",
            value: (
              <span className="font-mono [overflow-wrap:anywhere]">
                {member?.m365Email ?? (person.account.status === "linked" ? person.account.email : "")}
              </span>
            ),
          },
        ]
      : []),
  ]

  const photoGranted = consents.photo?.status === "granted"

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
    {
      id: "email",
      label: "PoliNetwork email",
      width: 280,
      priority: 3,
      mobile: "full",
      cell: (row) =>
        row.email ? <span className="block truncate font-mono text-[13px]">{row.email}</span> : <Unset />,
    },
  ]

  return (
    <>
      <PageBar description={`${name} · ${person.id}`} />
      <PageContent>
        <div className="flex flex-col gap-6">
          <CensusCard key={person.census.map((entry) => `${entry.year}:${entry.answer}`).join()} area={area} />

          {person.fees ? <MyFeeCard fees={person.fees} instructions={area.feeInstructions} /> : null}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard title="My roles" padding="flush">
                {member || isActiveAdmin(person) || admin?.capoScope || teams.length ? (
                  <Rows>
                    {member ? (
                      <Row
                        lead={<RowIcon icon={IdCard} />}
                        title={
                          <>
                            Member <MonoChip>{member.number}</MonoChip>
                          </>
                        }
                        meta={`Admitted ${formatDay(member.admittedOn)}${member.fee && !person.fees ? ` · Fee: ${FEE_STATUS[member.fee].label}` : ""}`}
                        end={<StateBadge state={MEMBER_STATUS[member.status]} />}
                      />
                    ) : null}
                    {admin && isActiveAdmin(person) ? (
                      <Row
                        lead={
                          <span className="grid size-8 place-items-center rounded-(--pn-r-3) bg-(--pn-muted)">
                            <PlatformGlyph platform="tg" className="size-4" />
                          </span>
                        }
                        title={`Admin of ${pluralize(admin.groups.length, "group")}`}
                        meta={`Since ${formatDay(admin.since)}`}
                        detail={admin.groups.map((group) => group.title).join(", ") || undefined}
                      />
                    ) : null}
                    {admin?.capoScope ? (
                      <Row
                        lead={<RowIcon icon={Crown} />}
                        title="Capo Admin"
                        meta={admin.capoScope}
                        end={
                          <IconButton
                            label="Open Capo Admin"
                            icon={ChevronRight}
                            nativeButton={false}
                            render={<Link to="/dashboard/telegram/capo" />}
                          />
                        }
                      />
                    ) : null}
                    {teams.map((membership) => (
                      <Row
                        key={membership.team}
                        lead={<RowIcon icon={Users} />}
                        title={
                          <>
                            {teamName(membership.team)}
                            <Chip>{membership.role === "lead" ? "Lead" : "Member"}</Chip>
                          </>
                        }
                        meta={`Since ${formatDay(membership.since)}`}
                        end={
                          membership.role === "lead" ? (
                            <IconButton
                              label="Open your team"
                              icon={ChevronRight}
                              nativeButton={false}
                              render={<Link to="/dashboard/people/teams" />}
                            />
                          ) : undefined
                        }
                      />
                    ))}
                  </Rows>
                ) : (
                  <p className="px-4 py-3 text-[13px] text-(--pn-fg-muted)">No active roles.</p>
                )}
              </SectionCard>

              <SectionCard title="People to contact" padding="flush">
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
                            : `${contact.email ?? ""} · for anything about your record`
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
                        ) : contact.email ? (
                          <IconButton
                            label={`Email ${contact.name}`}
                            icon={Mail}
                            nativeButton={false}
                            render={<a href={`mailto:${contact.email}`} />}
                          />
                        ) : undefined
                      }
                    />
                  ))}
                </Rows>
              </SectionCard>
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard
                title="My profile"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className={buttonMotion}
                    onClick={() => {
                      setCorrectionKey((value) => value + 1)
                      setCorrectionOpen(true)
                    }}
                  >
                    <Pencil data-icon="inline-start" />
                    Request a correction
                  </Button>
                }
              >
                <KeyValueList items={profileItems} />
              </SectionCard>

              <SectionCard title="My consents" padding="flush">
                <Rows>
                  {consents.privacy ? (
                    <Row
                      lead={<RowIcon icon={FileText} />}
                      title="Volunteer privacy policy"
                      meta={`Version ${consents.privacy.version} · accepted ${formatDay(consents.privacy.acceptedOn)}`}
                      end={<StatusBadge tone="success">Accepted</StatusBadge>}
                    />
                  ) : null}
                  <Row
                    lead={<RowIcon icon={Camera} />}
                    title="Photo and video"
                    meta={
                      consents.photo
                        ? `${photoGranted ? "Granted" : consents.photo.status === "denied" ? "Denied" : "Revoked"} ${formatDay(consents.photo.on)}`
                        : "Not granted"
                    }
                    end={
                      photoGranted ? (
                        <>
                          <StatusBadge tone="success">Granted</StatusBadge>
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(buttonMotion, "text-(--pn-danger-fg)")}
                            onClick={() => setRevokeOpen(true)}
                          >
                            Revoke
                          </Button>
                        </>
                      ) : (
                        <StatusBadge tone="neutral">
                          {consents.photo?.status === "revoked" ? "Revoked" : "Denied"}
                        </StatusBadge>
                      )
                    }
                  />
                </Rows>
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
      <CorrectionDialog key={`correction-${correctionKey}`} open={correctionOpen} onOpenChange={setCorrectionOpen} />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        tone="danger"
        icon={Camera}
        title="Revoke photo and video consent?"
        description="PoliNetwork stops using new photos and videos of you. Content already published stays unless you ask HR to remove it."
        confirmLabel="Revoke consent"
        onConfirm={async () => {
          await revoke()
          await refresh("Consent revoked.")
        }}
      />
    </>
  )
}
