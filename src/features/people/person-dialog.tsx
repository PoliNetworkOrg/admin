import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type ChangeEvent, useState } from "react"

import { checkboxControl, fieldControl, fieldHintId, FormDialog, FormField, SelectField } from "@/components/primitives"
import { useCan } from "@/components/shell"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { errorMessage, useRefreshAfter } from "./people-hooks"
import { createPerson, updatePerson } from "./people-write.functions"
import {
  type PersonRow,
  TEAM_IDS,
  TELEGRAM_USERNAME_PATTERN,
  type TeamId,
  type TeamRole,
  type TeamSummary,
} from "./people.contract"

const SAVE_ERROR = "Couldn't save the person. Check the values and try again."
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_TEAM = "none"

function validTelegram(value: string) {
  return value.trim() === "" || TELEGRAM_USERNAME_PATTERN.test(value.trim())
}

function validEmail(value: string) {
  return value.trim() === "" || EMAIL_PATTERN.test(value.trim())
}

/**
 * Add a person, or edit a record's name and contacts (`person`). Only the name is required. A new record can start
 * with roles (`teams` lists the teams to offer); they stay pending until the record is linked to an account.
 */
export function PersonDialog({
  open,
  onOpenChange,
  person,
  teams = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonRow
  teams?: readonly TeamSummary[]
}) {
  const create = useServerFn(createPerson)
  const update = useServerFn(updatePerson)
  const navigate = useNavigate()
  const refresh = useRefreshAfter()
  const canAppoint = useCan("people:appoint")
  const initial = {
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    contactEmail: person?.contactEmail ?? "",
    phone: person?.phone ?? "",
    telegramUsername: person?.telegramUsername ? `@${person.telegramUsername}` : "",
  }
  const [values, setValues] = useState(initial)
  const [admin, setAdmin] = useState(false)
  const [capo, setCapo] = useState(false)
  const [capoScope, setCapoScope] = useState("")
  const [teamRoles, setTeamRoles] = useState<Partial<Record<TeamId, TeamRole>>>({})
  const [submitted, setSubmitted] = useState(false)

  const errors: Partial<Record<keyof typeof initial | "capoScope", string>> = submitted
    ? {
        firstName: values.firstName.trim() ? undefined : "Enter a first name.",
        lastName: values.lastName.trim() ? undefined : "Enter a last name.",
        contactEmail: validEmail(values.contactEmail) ? undefined : "Enter a valid email address.",
        telegramUsername: validTelegram(values.telegramUsername)
          ? undefined
          : "Enter 5–32 letters, digits or underscores.",
        capoScope: capo && !capoScope.trim() ? "Enter what they coordinate." : undefined,
      }
    : {}
  const chosenTeams = TEAM_IDS.flatMap((team) => {
    const role = teamRoles[team]
    return role ? [{ team, role }] : []
  })
  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || admin || capo || chosenTeams.length > 0

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    setSubmitted(true)
    if (
      !values.firstName.trim() ||
      !values.lastName.trim() ||
      !validEmail(values.contactEmail) ||
      !validTelegram(values.telegramUsername) ||
      (capo && !capoScope.trim())
    ) {
      return
    }
    const fields = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      contactEmail: values.contactEmail.trim(),
      phone: values.phone.trim(),
      telegramUsername: values.telegramUsername.trim(),
    }
    if (person) {
      try {
        await update({ data: { ...fields, id: person.id } })
      } catch (caught) {
        console.error(caught)
        throw new Error(errorMessage(caught, SAVE_ERROR), { cause: caught })
      }
      await refresh("Record saved.")
      onOpenChange(false)
      return
    }
    let created: Awaited<ReturnType<typeof create>>
    try {
      created = await create({
        data: {
          ...fields,
          admin: admin || capo,
          capoScope: capo ? capoScope.trim() : null,
          teams: chosenTeams,
        },
      })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, SAVE_ERROR), { cause: caught })
    }
    onOpenChange(false)
    await navigate({ to: "/dashboard/people/$personId", params: { personId: created.id } })
    // The record exists either way: a refused role is reported, not a failed save.
    if (created.refused.length) {
      const list = created.refused.map((entry) => `${entry.role}: ${entry.message}`).join(" · ")
      await refresh(`Person added, but not every role was given. ${list}`, "warning")
    } else {
      await refresh("Person added.")
    }
  }

  const text = (key: keyof typeof initial, id: string) => ({
    id,
    value: values[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": fieldHintId(id),
  })

  const assignableTeams = teams.filter((team) => team.assignable.member || (canAppoint && team.assignable.lead))

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={person ? "Edit record" : "Add person"}
      description={
        person
          ? "Changes are saved to the record and shown in its activity."
          : "Only the name is required. The person doesn't need an account: their roles wait until you link one or they accept an invite."
      }
      noun="person"
      dirty={dirty}
      submitLabel={person ? "Save" : "Add person"}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 shell:grid-cols-2">
        <FormField label="First name" htmlFor="person-first" error={errors.firstName}>
          <Input {...text("firstName", "person-first")} autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField label="Last name" htmlFor="person-last" error={errors.lastName}>
          <Input {...text("lastName", "person-last")} autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField
          label="Contact email"
          htmlFor="person-email"
          optional
          hint="Where invites go. It doesn't have to be the address they sign in with."
          error={errors.contactEmail}
        >
          <Input {...text("contactEmail", "person-email")} type="email" autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField label="Phone" htmlFor="person-phone" optional>
          <Input {...text("phone", "person-phone")} type="tel" autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField
          label="Telegram username"
          htmlFor="person-telegram"
          optional
          hint="For contacting them. It isn't used to link an account."
          error={errors.telegramUsername}
        >
          <Input
            {...text("telegramUsername", "person-telegram")}
            placeholder="@username"
            autoComplete="off"
            className={cn(fieldControl, "font-mono")}
          />
        </FormField>
      </div>
      {person ? null : (
        <fieldset className="mt-6 flex flex-col gap-4">
          <legend className="mb-3 text-[14px] font-medium">
            Roles <span className="font-normal text-(--pn-fg-muted)">(optional)</span>
          </legend>
          <label className="flex items-start gap-2.5 text-[14px]">
            <Checkbox
              checked={admin || capo}
              disabled={capo}
              onCheckedChange={(checked) => setAdmin(checked === true)}
              className={checkboxControl}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Admin</span>
              <span className="text-xs text-(--pn-fg-muted)">Administers Telegram groups.</span>
            </span>
          </label>
          {canAppoint ? (
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2.5 text-[14px]">
                <Checkbox
                  checked={capo}
                  onCheckedChange={(checked) => setCapo(checked === true)}
                  className={checkboxControl}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Capo Admin</span>
                  <span className="text-xs text-(--pn-fg-muted)">Coordinates admins; makes them an admin too.</span>
                </span>
              </label>
              {capo ? (
                <FormField label="Capo Admin of" htmlFor="person-capo-scope" error={errors.capoScope}>
                  <Input
                    id="person-capo-scope"
                    value={capoScope}
                    onChange={(event) => setCapoScope(event.target.value)}
                    maxLength={120}
                    placeholder="e.g. Ingegneria Informatica"
                    autoComplete="off"
                    aria-invalid={errors.capoScope ? true : undefined}
                    aria-describedby={fieldHintId("person-capo-scope")}
                    className={fieldControl}
                  />
                </FormField>
              ) : null}
            </div>
          ) : null}
          {assignableTeams.length ? (
            <div className="grid grid-cols-1 gap-3 shell:grid-cols-2">
              {assignableTeams.map((team) => (
                <FormField key={team.id} label={team.name} htmlFor={`person-team-${team.id}`} optional>
                  <SelectField<TeamRole | typeof NO_TEAM>
                    id={`person-team-${team.id}`}
                    value={teamRoles[team.id] ?? NO_TEAM}
                    options={[
                      { value: NO_TEAM, label: "Not in the team" },
                      ...(team.assignable.member ? [{ value: "member" as const, label: "Member" }] : []),
                      ...(canAppoint && team.assignable.lead && !team.lead
                        ? [{ value: "lead" as const, label: "Lead" }]
                        : []),
                    ]}
                    onChange={(role) =>
                      setTeamRoles((current) => {
                        const next = { ...current }
                        if (role === NO_TEAM) delete next[team.id]
                        else next[team.id] = role
                        return next
                      })
                    }
                  />
                </FormField>
              ))}
            </div>
          ) : null}
        </fieldset>
      )}
    </FormDialog>
  )
}
