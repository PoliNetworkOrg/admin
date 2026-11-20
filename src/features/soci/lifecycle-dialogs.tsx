import { useServerFn } from "@tanstack/react-start"
import { Ban } from "lucide-react"
import { useState } from "react"

import {
  ConfirmDialog,
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  InlineAlert,
  SelectField,
} from "@/components/primitives"
import { Textarea } from "@/components/ui/textarea"
import { todayIso } from "@/features/people/people-format"
import { useRefreshAfter } from "@/features/people/people-hooks"
import { cn } from "@/lib/utils"

import { deleteSocioAccount } from "./soci-delete.functions"
import { END_REASON, socioName } from "./soci-format"
import { endSocio, restoreSocio } from "./soci-write.functions"
import { endInputSchema, restoreInputSchema, type EndInput, type SocioRow } from "./soci.contract"

type Props = { open: boolean; onOpenChange: (open: boolean) => void; socio: SocioRow }
const REASONS = ["resigned", "expelled", "deceased", "other"] as const

export function MembershipStatusDialog({ open, onOpenChange, socio, onChanged }: Props & { onChanged: () => void }) {
  const end = useServerFn(endSocio)
  const restore = useServerFn(restoreSocio)
  const refresh = useRefreshAfter()
  const restoring = !!socio.endedOn
  const [endedOn, setEndedOn] = useState(todayIso())
  const [endReason, setEndReason] = useState<EndInput["endReason"] | null>(null)
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit() {
    const parsed = restoring
      ? restoreInputSchema.safeParse({ number: socio.number, reason: note })
      : endInputSchema.safeParse({ number: socio.number, endedOn, endReason, endNote: note })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    if ("reason" in parsed.data) await restore({ data: parsed.data })
    else await end({ data: parsed.data })
    onChanged()
    await refresh(restoring ? "Membership restored." : "Membership ended. The account is pending deletion.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={restoring ? "Restore membership" : "End status"}
      description={socioName(socio)}
      noun="membership"
      tone={restoring ? undefined : "danger"}
      icon={restoring ? undefined : Ban}
      submitLabel={restoring ? "Restore" : "End status"}
      dirty={note !== "" || endReason !== null || endedOn !== todayIso()}
      onSubmit={submit}
    >
      <InlineAlert tone="warning">
        {restoring
          ? "Use Restore only to correct a mistake. The account will regain the Socio role. Unpaid fees remain due and may end the membership again if automatic lapse is enabled."
          : "The account loses the Socio role immediately and becomes pending deletion. The account itself is kept."}
      </InlineAlert>
      {!restoring ? (
        <>
          <FormField label="End date" htmlFor="membership-ended-on" error={errors.endedOn}>
            <DateField
              id="membership-ended-on"
              value={endedOn}
              onChange={(value) => {
                setEndedOn(value)
                setErrors((current) => ({ ...current, endedOn: "" }))
              }}
              invalid={!!errors.endedOn}
              describedBy={errors.endedOn ? fieldHintId("membership-ended-on") : undefined}
            />
          </FormField>
          <FormField label="Reason" htmlFor="membership-end-reason" error={errors.endReason}>
            <SelectField
              id="membership-end-reason"
              value={endReason}
              onChange={(value) => {
                setEndReason(value)
                setErrors((current) => ({ ...current, endReason: "" }))
              }}
              options={REASONS.map((value) => ({ value, label: END_REASON[value] }))}
              placeholder="Choose a reason"
              invalid={!!errors.endReason}
              describedBy={errors.endReason ? fieldHintId("membership-end-reason") : undefined}
            />
          </FormField>
        </>
      ) : null}
      <FormField
        label={restoring ? "Reason for the correction" : "Note"}
        htmlFor="membership-note"
        optional={!restoring}
        error={errors.reason ?? errors.endNote}
        counter={{ length: note.length, max: 500 }}
      >
        <Textarea
          id="membership-note"
          value={note}
          maxLength={500}
          onChange={(event) => {
            setNote(event.target.value)
            setErrors((current) => ({ ...current, reason: "", endNote: "" }))
          }}
          aria-invalid={!!(errors.reason || errors.endNote)}
          aria-describedby={errors.reason || errors.endNote ? fieldHintId("membership-note") : undefined}
          className={cn(fieldControl, "min-h-24")}
        />
      </FormField>
    </FormDialog>
  )
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  socio,
  finalFocus,
  onDeleted,
}: Props & { finalFocus?: () => HTMLElement | null; onDeleted: (id: string) => void }) {
  const remove = useServerFn(deleteSocioAccount)
  const refresh = useRefreshAfter()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Microsoft 365 account?"
      description={
        <>
          Permanently delete <strong className="break-all">{socio.mailbox}</strong>, including its mailbox and licences.
          The Libro Soci and its history are kept. This cannot be undone.
        </>
      }
      confirmLabel="Delete account"
      finalFocus={finalFocus}
      onConfirm={async () => {
        await remove({ data: { entraObjectId: socio.entraObjectId } })
        onDeleted(socio.entraObjectId)
        await refresh(`Account ${socio.mailbox} deleted.`)
      }}
    />
  )
}
