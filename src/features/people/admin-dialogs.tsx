import { useServerFn } from "@tanstack/react-start"
import { useMemo, useState } from "react"

import {
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  SelectField,
  Spinner,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { appointCapo, endCapo, setCapoScope } from "./people-appoint.functions"
import { personName, todayIso } from "./people-format"
import { errorMessage, useLoaded, useRefreshAfter, useReloadAfterFailure } from "./people-hooks"
import { type PersonOption, PersonPicker } from "./people-ui"
import { assignAdmin, endAdminRole, setCapoOfReference } from "./people-write.functions"
import type { CapoSummary } from "./people.contract"
import { getAdminsAndCapos } from "./people.functions"

const END_REASONS = ["Graduated", "No longer has time", "Left the association", "Removed by HR", "Other"] as const
type EndReason = (typeof END_REASONS)[number]

export type AdminTarget = { personId: string; name: string }

const NONE = "none"

/**
 * "Giulia Rossi · Ingegneria Informatica", for choosing a Capo Admin. Not one whose appointment Auth hasn't confirmed
 * yet: the backend only accepts a Capo Admin in effect.
 */
function capoOptions(capos: readonly CapoSummary[], exclude?: string) {
  return capos
    .filter((capo) => capo.person.id !== exclude && !(capo.capo.change === "start" && capo.capo.status === "sent"))
    .map((capo) => ({
      value: capo.person.id,
      label: `${personName(capo.person)}${capo.capo.capoScope ? ` · ${capo.capo.capoScope}` : ""}`,
    }))
    .toSorted((a, b) => a.label.localeCompare(b.label))
}

/** The Capo Admins, from the page when it has them, otherwise loaded while the dialog is open. */
function useCapos(open: boolean, capos: readonly CapoSummary[] | undefined) {
  const load = useServerFn(getAdminsAndCapos)
  const { data, failed } = useLoaded(
    useMemo(() => (open && !capos ? async () => (await load()).capos : null), [open, capos, load])
  )
  return { capos: capos ?? data, failed }
}

/** A role change's outcome: pending until the record is linked, otherwise sent to PoliNetwork Auth. */
export function changeOutcome(linked: boolean, done: string) {
  return linked ? `${done} PoliNetwork Auth applies it shortly.` : `${done} It waits until the record is linked.`
}

/**
 * Makes a person an admin. `person` fixes who (their record); otherwise the dialog offers `candidates`. For a linked
 * record Auth applies it, and may refuse; for an unlinked one it waits as pending.
 */
export function AssignAdminDialog({
  open,
  onOpenChange,
  person: fixedPerson,
  candidates = [],
  capos: givenCapos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonOption & { linked: boolean }
  candidates?: readonly (PersonOption & { linked: boolean })[]
  capos?: readonly CapoSummary[]
}) {
  const assign = useServerFn(assignAdmin)
  const refresh = useRefreshAfter()
  const reload = useReloadAfterFailure()
  const [person, setPerson] = useState<PersonOption | null>(fixedPerson ?? null)
  const [since, setSince] = useState(todayIso())
  const [capo, setCapo] = useState(NONE)
  const [submitted, setSubmitted] = useState(false)
  const { capos, failed } = useCapos(open, givenCapos)
  const personError = submitted && !person ? "Choose a person." : undefined
  const sinceError = submitted && !since ? "Choose the start date." : undefined

  async function submit() {
    setSubmitted(true)
    if (!person || !since) return
    try {
      await assign({ data: { personId: person.id, since, capoId: capo === NONE ? null : capo } })
    } catch (caught) {
      console.error(caught)
      reload()
      throw new Error(errorMessage(caught, "Couldn't make them an admin."), { cause: caught })
    }
    const linked = fixedPerson?.linked ?? candidates.find((candidate) => candidate.id === person.id)?.linked ?? false
    await refresh(changeOutcome(linked, `${person.name} is an admin.`))
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Make admin"
      description={fixedPerson ? fixedPerson.name : "Admins administer Telegram groups."}
      noun="admin role"
      dirty={(!fixedPerson && person !== null) || since !== todayIso() || capo !== NONE}
      submitLabel="Make admin"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {fixedPerson ? null : (
          <FormField
            label="Person"
            htmlFor="assign-admin-person"
            hint="Not in the list? Add the person from Overview first."
            error={personError}
          >
            <PersonPicker
              id="assign-admin-person"
              people={candidates}
              value={person}
              onChange={setPerson}
              invalid={!!personError}
            />
          </FormField>
        )}
        <FormField label="Since" htmlFor="assign-admin-since" error={sinceError}>
          <DateField
            id="assign-admin-since"
            value={since}
            onChange={setSince}
            invalid={!!sinceError}
            describedBy={sinceError ? fieldHintId("assign-admin-since") : undefined}
          />
        </FormField>
        <FormField
          label="Capo Admin of reference"
          htmlFor="assign-admin-capo"
          optional
          error={failed ? "Couldn't load the Capo Admins. Close and try again." : undefined}
        >
          {capos === null && !failed ? (
            <Spinner className="size-4" />
          ) : (
            <SelectField
              id="assign-admin-capo"
              value={capo}
              options={[{ value: NONE, label: "No Capo Admin" }, ...capoOptions(capos ?? [], person?.id)]}
              onChange={setCapo}
            />
          )}
        </FormField>
      </div>
    </FormDialog>
  )
}

/** The reason an admin or Capo Admin role ends: a preset, or free text for Other; saved in the record. */
function EndReasonFields({
  id,
  submitted,
  reason,
  details,
  onReason,
  onDetails,
}: {
  id: string
  submitted: boolean
  reason: EndReason | null
  details: string
  onReason: (reason: EndReason) => void
  onDetails: (details: string) => void
}) {
  const reasonError = submitted && !reason ? "Choose a reason." : undefined
  const detailsError = submitted && reason === "Other" && !details.trim() ? "Describe the reason." : undefined
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Reason" htmlFor={`${id}-reason`} error={reasonError}>
        <SelectField<EndReason>
          id={`${id}-reason`}
          value={reason}
          options={END_REASONS.map((value) => ({ value, label: value }))}
          onChange={onReason}
          placeholder="Choose a reason"
          invalid={!!reasonError}
        />
      </FormField>
      <FormField
        label="Details"
        htmlFor={`${id}-details`}
        optional={reason !== "Other"}
        hint="Saved in the record's activity."
        error={detailsError}
      >
        <Textarea
          id={`${id}-details`}
          value={details}
          onChange={(event) => onDetails(event.target.value)}
          maxLength={400}
          aria-invalid={detailsError ? true : undefined}
          aria-describedby={fieldHintId(`${id}-details`)}
          className={cn(fieldControl, "min-h-20")}
        />
      </FormField>
    </div>
  )
}

function reasonText(reason: EndReason, details: string) {
  const extra = details.trim()
  if (reason === "Other") return extra
  return extra ? `${reason}: ${extra}` : reason
}

/** Ends an admin or Capo Admin role with a reason. A linked record's role is taken back in Auth. */
function EndRoleDialog({
  open,
  onOpenChange,
  target,
  linked,
  role,
  description,
  end,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  linked: boolean
  role: "admin" | "Capo Admin"
  description: string
  end: (data: { personId: string; reason: string }) => Promise<void>
}) {
  const refresh = useRefreshAfter()
  const reload = useReloadAfterFailure()
  const [reason, setReason] = useState<EndReason | null>(null)
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)

  async function submit() {
    setSubmitted(true)
    if (!reason || (reason === "Other" && !details.trim())) return
    try {
      await end({ personId: target.personId, reason: reasonText(reason, details) })
    } catch (caught) {
      console.error(caught)
      reload()
      throw new Error(errorMessage(caught, `Couldn't end the ${role} role.`), { cause: caught })
    }
    await refresh(
      linked
        ? `${target.name}'s ${role} role is ending. PoliNetwork Auth takes it back shortly.`
        : `${target.name}'s ${role} role ended.`
    )
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`End ${role} role?`}
      description={description}
      noun="change"
      dirty={reason !== null || details.trim() !== ""}
      submitLabel={`End ${role} role`}
      tone="danger"
      onSubmit={submit}
    >
      <EndReasonFields
        id="end-role"
        submitted={submitted}
        reason={reason}
        details={details}
        onReason={setReason}
        onDetails={setDetails}
      />
    </FormDialog>
  )
}

export function EndAdminDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  linked: boolean
}) {
  const end = useServerFn(endAdminRole)
  return (
    <EndRoleDialog
      {...props}
      role="admin"
      description={`${props.target.name} stops being an admin. ${props.linked ? "PoliNetwork Auth takes the role back; " : ""}the record keeps the history.`}
      end={(data) => end({ data })}
    />
  )
}

export function EndCapoDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  linked: boolean
  scope: string
}) {
  const end = useServerFn(endCapo)
  return (
    <EndRoleDialog
      {...props}
      role="Capo Admin"
      description={`${props.target.name} stops being Capo Admin of ${props.scope} and stays an admin. The admins who answered to them have no Capo Admin until you set one.`}
      end={(data) => end({ data })}
    />
  )
}

/** Which Capo Admin an admin answers to: People's own data, nothing changes in Auth. */
export function CapoOfReferenceDialog({
  open,
  onOpenChange,
  target,
  current,
  capos: givenCapos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  current: string | null
  capos?: readonly CapoSummary[]
}) {
  const save = useServerFn(setCapoOfReference)
  const refresh = useRefreshAfter()
  const [value, setValue] = useState(current ?? NONE)
  const { capos, failed } = useCapos(open, givenCapos)

  async function submit() {
    if (value === (current ?? NONE)) {
      onOpenChange(false)
      return
    }
    try {
      await save({ data: { personId: target.personId, capoId: value === NONE ? null : value } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't change the Capo Admin."), { cause: caught })
    }
    await refresh("Capo Admin of reference saved.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Capo Admin of reference"
      description={`The Capo Admin ${target.name} answers to. They see ${target.name} in Telegram › Capo Admin.`}
      noun="change"
      dirty={value !== (current ?? NONE)}
      submitLabel="Save"
      canSubmit={capos !== null}
      onSubmit={submit}
    >
      <FormField
        label="Capo Admin"
        htmlFor="capo-of-reference"
        error={failed ? "Couldn't load the Capo Admins. Close and try again." : undefined}
      >
        {capos === null && !failed ? (
          <Spinner className="size-4" />
        ) : (
          <SelectField
            id="capo-of-reference"
            value={value}
            options={[{ value: NONE, label: "No Capo Admin" }, ...capoOptions(capos ?? [], target.personId)]}
            onChange={setValue}
          />
        )}
      </FormField>
    </FormDialog>
  )
}

/** What a Capo Admin coordinates, e.g. a course: free text, at most 120 characters. */
function ScopeField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <FormField
      label="Capo Admin of"
      htmlFor="capo-scope"
      hint="A course or area, e.g. Ingegneria Informatica."
      error={error}
    >
      <Input
        id="capo-scope"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={120}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldHintId("capo-scope")}
        className={fieldControl}
      />
    </FormField>
  )
}

/**
 * Appoints a current admin Capo Admin. `person` fixes who (their record); otherwise the dialog offers `candidates`,
 * the admins who aren't Capo Admins yet.
 */
export function AppointCapoDialog({
  open,
  onOpenChange,
  person: fixedPerson,
  candidates = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonOption & { linked: boolean }
  candidates?: readonly (PersonOption & { linked: boolean })[]
}) {
  const appoint = useServerFn(appointCapo)
  const refresh = useRefreshAfter()
  const reload = useReloadAfterFailure()
  const [person, setPerson] = useState<PersonOption | null>(fixedPerson ?? null)
  const [since, setSince] = useState(todayIso())
  const [scope, setScope] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const personError = submitted && !person ? "Choose an admin." : undefined
  const scopeError = submitted && !scope.trim() ? "Enter what they coordinate." : undefined
  const sinceError = submitted && !since ? "Choose the start date." : undefined

  async function submit() {
    setSubmitted(true)
    if (!person || !scope.trim() || !since) return
    try {
      await appoint({ data: { personId: person.id, since, scope: scope.trim() } })
    } catch (caught) {
      console.error(caught)
      reload()
      throw new Error(errorMessage(caught, "Couldn't appoint the Capo Admin."), { cause: caught })
    }
    const linked = fixedPerson?.linked ?? candidates.find((candidate) => candidate.id === person.id)?.linked ?? false
    await refresh(changeOutcome(linked, `${person.name} appointed Capo Admin.`))
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Appoint Capo Admin"
      description={`${fixedPerson ? fixedPerson.name : "An admin"} coordinates the admins who have them as Capo Admin of reference, and sees them in Telegram › Capo Admin.`}
      noun="appointment"
      dirty={(!fixedPerson && person !== null) || scope.trim() !== "" || since !== todayIso()}
      submitLabel="Appoint Capo Admin"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {fixedPerson ? null : (
          <FormField
            label="Admin"
            htmlFor="appoint-capo-person"
            hint="Only current admins can be Capo Admins."
            error={personError}
          >
            <PersonPicker
              id="appoint-capo-person"
              people={candidates}
              value={person}
              onChange={setPerson}
              invalid={!!personError}
            />
          </FormField>
        )}
        <ScopeField value={scope} onChange={setScope} error={scopeError} />
        <FormField label="Since" htmlFor="appoint-capo-since" error={sinceError}>
          <DateField
            id="appoint-capo-since"
            value={since}
            onChange={setSince}
            invalid={!!sinceError}
            describedBy={sinceError ? fieldHintId("appoint-capo-since") : undefined}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

/** Changes what a Capo Admin coordinates: People's own data, nothing changes in Auth. */
export function CapoScopeDialog({
  open,
  onOpenChange,
  target,
  scope: currentScope,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  scope: string
}) {
  const save = useServerFn(setCapoScope)
  const refresh = useRefreshAfter()
  const [scope, setScope] = useState(currentScope)
  const [submitted, setSubmitted] = useState(false)
  const error = submitted && !scope.trim() ? "Enter what they coordinate." : undefined

  async function submit() {
    setSubmitted(true)
    if (!scope.trim()) return
    if (scope.trim() === currentScope) {
      onOpenChange(false)
      return
    }
    try {
      await save({ data: { personId: target.personId, scope: scope.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't change the scope."), { cause: caught })
    }
    await refresh("Capo Admin scope changed.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Capo Admin scope"
      description={target.name}
      noun="change"
      dirty={scope.trim() !== currentScope}
      submitLabel="Change scope"
      onSubmit={submit}
    >
      <ScopeField value={scope} onChange={setScope} error={error} />
    </FormDialog>
  )
}
