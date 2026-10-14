import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"

import { fieldControl, fieldHintId, FormDialog, FormField, Spinner } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { teamName, todayIso } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { addTeamMember, endTeamMembership, getTeamCandidates, updateTeamFields } from "./people-teams.functions"
import { ChoiceChips, type PersonOption, PersonPicker, RadioCard, SelectField } from "./people-ui"
import { TEAM_IDS, type TeamFields, teamFields, type TeamId } from "./people.contract"

type Role = "member" | "lead"

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
 * The Lead role is offered only with `people:appoint`.
 */
export function AddToTeamDialog({
  open,
  onOpenChange,
  team: fixedTeam,
  teams = TEAM_IDS,
  person: fixedPerson,
  canAppoint,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: TeamId
  /** Teams to choose from when `team` isn't fixed. */
  teams?: readonly TeamId[]
  person?: PersonOption
  canAppoint: boolean
}) {
  const add = useServerFn(addTeamMember)
  const loadCandidates = useServerFn(getTeamCandidates)
  const refresh = useRefreshAfter()
  const [team, setTeam] = useState<TeamId | null>(fixedTeam ?? null)
  const [person, setPerson] = useState<PersonOption | null>(fixedPerson ?? null)
  const [candidates, setCandidates] = useState<PersonOption[] | null>(null)
  const [candidatesError, setCandidatesError] = useState(false)
  const [role, setRole] = useState<Role>("member")
  const [since, setSince] = useState(todayIso())
  const [fields, setFields] = useState<TeamFields>(fixedTeam ? emptyFields(fixedTeam) : {})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open || fixedPerson || !team) return
    let active = true
    setCandidates(null)
    setCandidatesError(false)
    loadCandidates({ data: { teamId: team } }).then(
      (rows) => {
        if (active) setCandidates(rows.map((row) => ({ id: row.id, name: row.name })))
      },
      (caught) => {
        console.error(caught)
        if (active) setCandidatesError(true)
      }
    )
    return () => {
      active = false
    }
  }, [open, fixedPerson, team, loadCandidates])

  const teamError = submitted && !team ? "Choose a team." : undefined
  const personError = submitted && !person ? "Choose a person." : undefined
  const sinceError = submitted && !since ? "Choose the start date." : undefined
  const title = fixedTeam ? `Add to ${teamName(fixedTeam)}` : "Add to team"

  async function submit() {
    setSubmitted(true)
    if (!team || !person || !since) return
    try {
      await add({ data: { teamId: team, personId: person.id, role, since, fields: cleanFields(fields) } })
    } catch (caught) {
      console.error(caught)
      const fallback = "The person could not be added to the team."
      throw new Error(caught instanceof Error ? errorMessage(caught, fallback) : fallback, { cause: caught })
    }
    await refresh(`${person.name} added to ${teamName(team)}.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={title}
      description={
        fixedPerson
          ? `Adds ${fixedPerson.name} to a team.`
          : `Adds an existing person to ${fixedTeam ? teamName(fixedTeam) : "a team"}.${canAppoint ? "" : " Appointing a Team Lead is up to the Direttivo."}`
      }
      noun="team membership"
      dirty={(!fixedTeam && team !== null) || (!fixedPerson && person !== null) || role !== "member"}
      submitLabel={title}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {fixedTeam ? null : (
          <FormField label="Team" htmlFor="team-add-team" error={teamError}>
            <SelectField<TeamId>
              id="team-add-team"
              value={team}
              options={teams.map((value) => ({ value, label: teamName(value) }))}
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
          {canAppoint ? (
            <fieldset className="flex flex-col gap-2 shell:col-span-2">
              <legend className="mb-2 text-[13px] font-medium">Role</legend>
              <div className="grid grid-cols-1 gap-2 shell:grid-cols-2">
                <RadioCard
                  name="team-role"
                  value="member"
                  checked={role === "member"}
                  onSelect={() => setRole("member")}
                  label="Member"
                />
                <RadioCard
                  name="team-role"
                  value="lead"
                  checked={role === "lead"}
                  onSelect={() => setRole("lead")}
                  label="Team Lead"
                  description="Manages the team's members from Teams."
                />
              </div>
            </fieldset>
          ) : null}
          <FormField label="Since" htmlFor="team-add-since" error={sinceError}>
            <Input
              id="team-add-since"
              type="date"
              value={since}
              onChange={(event) => setSince(event.target.value)}
              aria-invalid={sinceError ? true : undefined}
              aria-describedby={fieldHintId("team-add-since")}
              className={fieldControl}
            />
          </FormField>
        </div>
        {team ? <TeamFieldInputs team={team} value={fields} onChange={setFields} /> : null}
      </div>
    </FormDialog>
  )
}

export type TeamMemberTarget = { personId: string; name: string; team: TeamId; fields: TeamFields }

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
      const fallback = "The team fields could not be saved."
      throw new Error(caught instanceof Error ? errorMessage(caught, fallback) : fallback, { cause: caught })
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

/** Ends a team membership with its last day and reason; history and census answers stay. */
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
  const [reason, setReason] = useState<EndReason | null>(null)
  const [lastDay, setLastDay] = useState(todayIso())
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const reasonError = submitted && !reason ? "Choose a reason." : undefined
  const noteError = submitted && reason === "Other" && !note.trim() ? "Describe the reason." : undefined
  const lastDayError = submitted && !lastDay ? "Choose the last day." : undefined

  async function submit() {
    setSubmitted(true)
    if (!reason || !lastDay || (reason === "Other" && !note.trim())) return
    try {
      await end({
        data: {
          teamId: target.team,
          personId: target.personId,
          lastDay,
          reason: reason === "Other" ? note.trim() : reason,
          note: reason === "Other" ? "" : note.trim(),
        },
      })
    } catch (caught) {
      console.error(caught)
      const fallback = "The membership could not be ended."
      throw new Error(caught instanceof Error ? errorMessage(caught, fallback) : fallback, { cause: caught })
    }
    await refresh("Membership ended.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="End membership?"
      description={`${target.name} leaves ${teamName(target.team)} on the last day below. Their history and census answers stay.`}
      noun="change"
      dirty={reason !== null || note.trim() !== ""}
      submitLabel="End membership"
      submitTone="danger"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 shell:grid-cols-2">
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
          <FormField label="Last day" htmlFor="end-team-last-day" error={lastDayError}>
            <Input
              id="end-team-last-day"
              type="date"
              value={lastDay}
              onChange={(event) => setLastDay(event.target.value)}
              aria-invalid={lastDayError ? true : undefined}
              aria-describedby={fieldHintId("end-team-last-day")}
              className={fieldControl}
            />
          </FormField>
        </div>
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
            maxLength={500}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={fieldHintId("end-team-note")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}
