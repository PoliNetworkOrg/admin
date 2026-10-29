import { useServerFn } from "@tanstack/react-start"
import { Crown } from "lucide-react"
import { useMemo, useState } from "react"

import {
  ConfirmDialog,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  SelectField,
  Spinner,
} from "@/components/primitives"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { setCapoScope } from "./people-appoint.functions"
import { personName } from "./people-format"
import { errorMessage, useLoaded, useRefreshAfter } from "./people-hooks"
import { endAdminRole, setCapoOfReference } from "./people-write.functions"
import { COURSES, type PersonRow } from "./people.contract"
import { getPeople } from "./people.functions"

const END_REASONS = ["Graduated", "No longer has time", "Left the association", "Removed by HR", "Other"] as const
type EndReason = (typeof END_REASONS)[number]

export type AdminTarget = { personId: string; name: string }

/** Ends an admin role with a reason; the bot removes their admin rights. */
export function EndAdminDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
}) {
  const end = useServerFn(endAdminRole)
  const refresh = useRefreshAfter()
  const [reason, setReason] = useState<EndReason | null>(null)
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const reasonError = submitted && !reason ? "Choose a reason." : undefined
  const detailsError = submitted && reason === "Other" && !details.trim() ? "Describe the reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!reason || (reason === "Other" && !details.trim())) return
    const text = reason === "Other" ? details.trim() : details.trim() ? `${reason}: ${details.trim()}` : reason
    try {
      await end({ data: { personId: target.personId, reason: text } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't end the admin role."), { cause: caught })
    }
    await refresh("Admin role ended.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="End admin role?"
      description={`${target.name} stops being an admin. The bot removes their admin rights; the record keeps the history.`}
      noun="change"
      dirty={reason !== null || details.trim() !== ""}
      submitLabel="End admin role"
      tone="danger"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <FormField label="Reason" htmlFor="end-admin-reason" error={reasonError}>
          <SelectField<EndReason>
            id="end-admin-reason"
            value={reason}
            options={END_REASONS.map((value) => ({ value, label: value }))}
            onChange={setReason}
            placeholder="Choose a reason"
            invalid={!!reasonError}
          />
        </FormField>
        <FormField
          label="Details"
          htmlFor="end-admin-details"
          optional={reason !== "Other"}
          hint="Saved in the record's activity."
          error={detailsError}
        >
          <Textarea
            id="end-admin-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={400}
            aria-invalid={detailsError ? true : undefined}
            aria-describedby={fieldHintId("end-admin-details")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

type CapoOption = { id: string; label: string }

function capoOptions(people: readonly PersonRow[]): CapoOption[] {
  return people
    .filter((person) => person.admin?.status === "active" && person.admin.capoScope)
    .map((person) => ({ id: person.id, label: `${personName(person)} · ${person.admin?.capoScope ?? ""}` }))
    .toSorted((a, b) => a.label.localeCompare(b.label))
}

const NONE = "none"

/** Which Capo Admin an admin answers to. Loads the Capo Admins itself when the page has no people list. */
export function CapoOfReferenceDialog({
  open,
  onOpenChange,
  target,
  current,
  people,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  current: string | null
  people?: readonly PersonRow[]
}) {
  const save = useServerFn(setCapoOfReference)
  const load = useServerFn(getPeople)
  const refresh = useRefreshAfter()
  const [value, setValue] = useState(current ?? NONE)
  // Pages that already hold every person pass them; the record page loads them.
  const { data: rows, failed: loadError } = useLoaded(useMemo(() => (people ? null : () => load()), [people, load]))
  const loaded = people ? capoOptions(people) : rows ? capoOptions(rows) : null

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

  const options = [
    { value: NONE, label: "No Capo Admin" },
    ...(loaded ?? []).map((option) => ({ value: option.id, label: option.label })),
  ]

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Capo Admin of reference"
      description={`The Capo Admin ${target.name} answers to. They see ${target.name} in Telegram › Capo Admin and in My area.`}
      noun="change"
      dirty={value !== (current ?? NONE)}
      submitLabel="Save"
      canSubmit={loaded !== null}
      onSubmit={submit}
    >
      <FormField
        label="Capo Admin"
        htmlFor="capo-of-reference"
        error={loadError ? "Couldn't load the Capo Admins. Close and try again." : undefined}
      >
        {loaded === null && !loadError ? (
          <Spinner className="size-4" />
        ) : (
          <SelectField id="capo-of-reference" value={value} options={options} onChange={setValue} />
        )}
      </FormField>
    </FormDialog>
  )
}

/** Appoints a Capo Admin of a course, or changes their course. Direttivo only. */
export function CapoScopeDialog({
  open,
  onOpenChange,
  target,
  scope,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  scope: string | null
}) {
  const save = useServerFn(setCapoScope)
  const refresh = useRefreshAfter()
  const [value, setValue] = useState<string | null>(scope)
  const [submitted, setSubmitted] = useState(false)
  const error = submitted && !value ? "Choose a course." : undefined

  async function submit() {
    setSubmitted(true)
    if (!value) return
    if (value === scope) {
      onOpenChange(false)
      return
    }
    try {
      await save({ data: { personId: target.personId, scope: value } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't save the Capo Admin role."), { cause: caught })
    }
    await refresh(scope ? "Capo Admin scope changed." : `${target.name} appointed Capo Admin.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={scope ? "Change Capo Admin scope" : "Appoint as Capo Admin"}
      description={`${target.name} coordinates the admins of the course's groups and sees them in Telegram › Capo Admin.`}
      noun="appointment"
      dirty={value !== scope}
      submitLabel={scope ? "Change scope" : "Appoint Capo Admin"}
      onSubmit={submit}
    >
      <FormField label="Course" htmlFor="capo-scope" error={error}>
        <SelectField
          id="capo-scope"
          value={value}
          options={COURSES.map((course) => ({ value: course, label: course }))}
          onChange={setValue}
          placeholder="Choose a course"
          invalid={!!error}
        />
      </FormField>
    </FormDialog>
  )
}

/** Ends the Capo Admin role; they stay an admin. */
export function EndCapoDialog({
  open,
  onOpenChange,
  target,
  scope,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: AdminTarget
  scope: string
}) {
  const save = useServerFn(setCapoScope)
  const refresh = useRefreshAfter()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={Crown}
      title="End Capo Admin role?"
      description={`${target.name} stops being Capo Admin of ${scope}. They stay an admin of their groups; the admins who answered to them have no Capo Admin until you set one.`}
      confirmLabel="End Capo Admin role"
      onConfirm={async () => {
        await save({ data: { personId: target.personId, scope: null } })
        await refresh("Capo Admin role ended.")
      }}
    />
  )
}
