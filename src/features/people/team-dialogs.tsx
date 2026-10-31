import { useServerFn } from "@tanstack/react-start"
import { useMemo, useState } from "react"

import {
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  RadioCard,
  RadioCardGroup,
  SelectField,
  Spinner,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { changeOutcome } from "./admin-dialogs"
import { teamName, todayIso } from "./people-format"
import { errorMessage, useLoaded, useRefreshAfter, useReloadAfterFailure } from "./people-hooks"
import { addTeamMember, endTeamMembership, getTeamCandidates, updateTeamFields } from "./people-teams.functions"
import { ChoiceChips, type PersonOption, PersonPicker } from "./people-ui"
import { TEAM_IDS, type TeamFields, teamFields, type TeamId, type TeamRole, type TeamSummary } from "./people.contract"

type Role = TeamRole
/** Which roles PoliNetwork Auth binds for each team, and whether it already has a Lead. */
export type TeamAvailability = Pick<TeamSummary, "id" | "assignable" | "lead">

function emptyFields(team: TeamId): TeamFields {
  return Object.fromEntries(teamFields(team).map((field) => [field.key, field.kind === "multi" ? [] : ""]))
}

/** Trims text values and drops empty ones, so the record only stores what was filled in. */
function cleanFields(fields: TeamFields): TeamFields {
  const clean: TeamFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      if (value.length) clean[key] = value
    } else if (value.trim()) clean[key] = value.trim()
  }
  return clean
}

/** The team's own fields: text inputs and multi-select pills. */
function TeamFieldInputs({
  team,
  value,
  onChange,
}: {
  team: TeamId
  value: TeamFields
  onChange: (value: TeamFields) => void
}) {
  return (
    <>
      {teamFields(team).map((field) => {
        const id = `team-field-${field.key}`
        const current = value[field.key]
        return (
          <FormField key={field.key} label={field.label} htmlFor={id} optional>
            {field.kind === "multi" ? (
              <ChoiceChips
                id={id}
                label={field.label}
                options={field.options ?? []}
                value={Array.isArray(current) ? current : []}
                onChange={(next) => onChange({ ...value, [field.key]: next })}
              />
            ) : (
              <Input
                id={id}
                value={Array.isArray(current) ? "" : (current ?? "")}
                onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                maxLength={200}
                autoComplete="off"
                aria-describedby={fieldHintId(id)}
                className={cn(fieldControl, field.mono && "font-mono")}
              />
            )}
          </FormField>
        )
      })}
    </>
  )
}

/**
 * Adds an existing person to a team. `team` fixes the team (a team page); `person` fixes the person (their record).
 * Only roles Auth binds are offered, and the Lead role only with `people:appoint` to a team without one.
 */
export function AddToTeamDialog({
  open,
  onOpenChange,
  team: fixedTeam,
  teams = TEAM_IDS,
  availability = [],
  person: fixedPerson,
  canAppoint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: TeamId
  /** Teams to choose from when `team` isn't fixed. */
  teams?: readonly TeamId[]
  /** What Auth binds per team; a team missing here is offered as assignable. */
  availability?: readonly TeamAvailability[]
  person?: PersonOption & { linked: boolean }
  canAppoint: boolean
}) {
  const add = useServerFn(addTeamMember)
  const loadCandidates = useServerFn(getTeamCandidates)
  const refresh = useRefreshAfter()
  const reload = useReloadAfterFailure()
  const [team, setTeam] = useState<TeamId | null>(fixedTeam ?? null)
  const [person, setPerson] = useState<PersonOption | null>(fixedPerson ?? null)
  const [role, setRole] = useState<Role>("member")
  const [since, setSince] = useState(todayIso())
  const [fields, setFields] = useState<TeamFields>(fixedTeam ? emptyFields(fixedTeam) : {})
  const [submitted, setSubmitted] = useState(false)

  const { data: candidateRows, failed: candidatesError } = useLoaded(
    useMemo(
      () => (open && !fixedPerson && team ? () => loadCandidates({ data: { teamId: team } }) : null),
      [open, fixedPerson, team, loadCandidates]
    )
  )
  const candidates = candidateRows?.map((row) => ({ id: row.id, name: row.name })) ?? null

  const available = (id: TeamId | null) => availability.find((entry) => entry.id === id)
  const memberBound = (id: TeamId) => available(id)?.assignable.member ?? true
  const leadOpen = (id: TeamId | null) => {
    const entry = available(id)
    return canAppoint && (entry ? entry.assignable.lead && !entry.lead : true)
  }
  const choosable = teams.filter((id) => memberBound(id) || leadOpen(id))
  // A team that only binds a Lead role takes a Lead; one that can't take a Lead (another team chosen after "Team Lead")
  // takes a member.
  const roleChoice: Role = !team ? role : !memberBound(team) ? "lead" : leadOpen(team) ? role : "member"

  const teamError = submitted && !team ? "Choose a team." : undefined
  const personError = submitted && !person ? "Choose a person." : undefined
  const sinceError = submitted && !since ? "Choose the start date." : undefined
  const title = fixedTeam ? `Add to ${teamName(fixedTeam)}` : "Add to team"

  async function submit() {
    setSubmitted(true)
    if (!team || !person || !since) return
    try {
      await add({ data: { teamId: team, personId: person.id, role: roleChoice, since, fields: cleanFields(fields) } })
    } catch (caught) {
      console.error(caught)
      reload()
      throw new Error(errorMessage(caught, "Couldn't add the person to the team."), { cause: caught })
    }
    await refresh(
      fixedPerson
        ? changeOutcome(fixedPerson.linked, `${person.name} added to ${teamName(team)}.`)
        : `${person.name} added to ${teamName(team)}.`
    )
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={title}
      description={fixedPerson ? fixedPerson.name : "Team history stays on the person’s record."}
      noun="team membership"
      dirty={
        (!fixedTeam && team !== null) ||
        (!fixedPerson && person !== null) ||
        role !== "member" ||
        since !== todayIso() ||
        Object.keys(cleanFields(fields)).length > 0
      }
      submitLabel={title}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {fixedTeam ? null : (
          <FormField label="Team" htmlFor="team-add-team" error={teamError}>
            <SelectField<TeamId>
              id="team-add-team"
              value={team}
              options={choosable.map((value) => ({ value, label: teamName(value) }))}
              onChange={(next) => {
                setTeam(next)
                setFields(emptyFields(next))
                if (!fixedPerson) setPerson(null)
              }}
              placeholder="Choose a team"
              invalid={!!teamError}
            />
          </FormField>
        )}
        {fixedPerson ? null : (
          <FormField
            label="Person"
            htmlFor="team-add-person"
            hint="Not in the list? Ask HR to add the person first."
            error={candidatesError ? "Couldn't load people. Close and try again." : personError}
          >
            {team && candidates === null && !candidatesError ? (
              <Spinner className="size-4" />
            ) : (
              <PersonPicker
                id="team-add-person"
                people={candidates ?? []}
                value={person}
                onChange={setPerson}
                invalid={!!personError}
                disabled={!team || candidatesError}
              />
            )}
          </FormField>
        )}
        <div className="grid grid-cols-1 gap-4 shell:grid-cols-2">
          {leadOpen(team) && (!team || memberBound(team)) ? (
            <div className="shell:col-span-2">
              <RadioCardGroup
                label="Role"
                value={roleChoice}
                onValueChange={setRole}
                className="grid grid-cols-1 gap-2 shell:grid-cols-2"
              >
                <RadioCard value="member" label="Member" />
                <RadioCard value="lead" label="Team Lead" description="Manages the team's members from Teams." />
              </RadioCardGroup>
            </div>
          ) : null}
          <FormField label="Since" htmlFor="team-add-since" error={sinceError}>
            <DateField
              id="team-add-since"
              value={since}
              onChange={setSince}
              invalid={!!sinceError}
              describedBy={sinceError ? fieldHintId("team-add-since") : undefined}
            />
          </FormField>
        </div>
        {team ? <TeamFieldInputs team={team} value={fields} onChange={setFields} /> : null}
      </div>
    </FormDialog>
  )
}

export type TeamMemberTarget = {
  personId: string
  name: string
  team: TeamId
  fields: TeamFields
  linked: boolean
}

export function EditTeamFieldsDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: TeamMemberTarget
}) {
  const save = useServerFn(updateTeamFields)
  const refresh = useRefreshAfter()
  const initial = { ...emptyFields(target.team), ...target.fields }
  const [fields, setFields] = useState(initial)

  async function submit() {
    try {
      await save({ data: { teamId: target.team, personId: target.personId, fields: cleanFields(fields) } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't save the team fields."), { cause: caught })
    }
    await refresh("Team fields saved.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit team fields"
      description={`${target.name} in ${teamName(target.team)}.`}
      noun="team fields"
      dirty={JSON.stringify(fields) !== JSON.stringify(initial)}
      submitLabel="Save fields"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <TeamFieldInputs team={target.team} value={fields} onChange={setFields} />
      </div>
    </FormDialog>
  )
}

const END_REASONS = [
  "Graduated",
  "No longer has time",
  "Moved to another team",
  "Left the association",
  "Other",
] as const
type EndReason = (typeof END_REASONS)[number]

/** Ends a team membership with a reason; the history stays. A linked record's role is taken back in Auth. */
export function EndTeamMembershipDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: TeamMemberTarget
}) {
  const end = useServerFn(endTeamMembership)
  const refresh = useRefreshAfter()
  const reload = useReloadAfterFailure()
  const [reason, setReason] = useState<EndReason | null>(null)
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const reasonError = submitted && !reason ? "Choose a reason." : undefined
  const noteError = submitted && reason === "Other" && !note.trim() ? "Describe the reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!reason || (reason === "Other" && !note.trim())) return
    const text = reason === "Other" ? note.trim() : note.trim() ? `${reason}: ${note.trim()}` : reason
    try {
      await end({ data: { teamId: target.team, personId: target.personId, reason: text } })
    } catch (caught) {
      console.error(caught)
      reload()
      throw new Error(errorMessage(caught, "Couldn't end the membership."), { cause: caught })
    }
    await refresh(
      target.linked ? "Membership ending. PoliNetwork Auth takes the role back shortly." : "Membership ended."
    )
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="End membership?"
      description={`${target.name} leaves ${teamName(target.team)} today. Their history stays.`}
      noun="change"
      dirty={reason !== null || note.trim() !== ""}
      submitLabel="End membership"
      tone="danger"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <FormField label="Reason" htmlFor="end-team-reason" error={reasonError}>
          <SelectField<EndReason>
            id="end-team-reason"
            value={reason}
            options={END_REASONS.map((value) => ({ value, label: value }))}
            onChange={setReason}
            placeholder="Choose a reason"
            invalid={!!reasonError}
          />
        </FormField>
        <FormField
          label="Note"
          htmlFor="end-team-note"
          optional={reason !== "Other"}
          hint="Saved in the record's activity."
          error={noteError}
        >
          <Textarea
            id="end-team-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={400}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={fieldHintId("end-team-note")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}
