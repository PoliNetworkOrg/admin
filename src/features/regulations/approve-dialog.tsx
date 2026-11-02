import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import {
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  RadioCard,
  RadioCardGroup,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"

import { BODY_LABELS, todayInRome } from "./regulations-format"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { approveDraft } from "./regulations-manage.functions"
import type { DeliberaBody, Draft } from "./regulations.contract"

const APPROVE_ERROR = "Non è stato possibile registrare l'approvazione. Riprova."

function validUrl(value: string) {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol)
}

/**
 * "Registra l'approvazione": the outcome of a vote held outside the dashboard. The body, the day of the vote and,
 * optionally, a link to the verbale; the document then prints "Approvato dal … il …".
 */
export function ApproveDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: Pick<Draft, "id" | "title">
}) {
  const approve = useServerFn(approveDraft)
  const refresh = useRefreshAfter()
  const [body, setBody] = useState<DeliberaBody | null>(null)
  const [date, setDate] = useState(todayInRome())
  const [verbale, setVerbale] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const bodyError = submitted && !body ? "Scegli l'organo che ha approvato." : undefined
  const dateError =
    submitted && !date
      ? "Indica il giorno della votazione."
      : date > todayInRome()
        ? "La data è nel futuro."
        : undefined
  const verbaleError =
    submitted && verbale.trim() && !validUrl(verbale.trim()) ? "Inserisci un indirizzo http o https." : undefined

  async function submit() {
    setSubmitted(true)
    if (!body || !date || date > todayInRome() || (verbale.trim() && !validUrl(verbale.trim()))) return
    try {
      await approve({
        data: {
          draftId: draft.id,
          to: "approvata",
          delibera: { body, date, verbaleUrl: verbale.trim() || null },
        },
      })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, APPROVE_ERROR), { cause: caught })
    }
    await refresh("Approvazione registrata.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      locale="it"
      open={open}
      onOpenChange={onOpenChange}
      title="Registra l'approvazione"
      description={`L'esito della votazione su «${draft.title}». Il documento riporterà l'organo e la data; da qui decorrono i tre giorni per emanarlo.`}
      noun="approvazione"
      dirty={body !== null || verbale.trim() !== "" || date !== todayInRome()}
      submitLabel="Registra l'approvazione"
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <RadioCardGroup
          label="Organo"
          value={body}
          onValueChange={setBody}
          invalid={bodyError !== undefined}
          describedBy={bodyError ? fieldHintId("approve-body") : undefined}
        >
          <RadioCard
            value="consiglio_direttivo"
            label={BODY_LABELS.consiglio_direttivo}
            description="Il caso ordinario: il Direttivo approva la nuova Raccolta."
          />
          <RadioCard
            value="assemblea"
            label={BODY_LABELS.assemblea}
            description="Per il Regolamento Fondamentale, o quando l'Assemblea cambia il testo, anche con voto telematico."
          />
        </RadioCardGroup>
        {bodyError ? (
          <p id={fieldHintId("approve-body")} className="-mt-2 text-xs text-(--pn-danger-fg)">
            {bodyError}
          </p>
        ) : null}
        <FormField label="Data della votazione" htmlFor="approve-date" error={dateError}>
          <DateField
            id="approve-date"
            value={date}
            onChange={setDate}
            invalid={dateError !== undefined}
            describedBy={fieldHintId("approve-date")}
            futureYears={0}
          />
        </FormField>
        <FormField
          label="Verbale (facoltativo)"
          htmlFor="approve-verbale"
          hint="Il link al verbale della seduta, se è già pubblicato."
          error={verbaleError}
        >
          <Input
            id="approve-verbale"
            type="url"
            inputMode="url"
            value={verbale}
            onChange={(event) => setVerbale(event.target.value)}
            placeholder="https://"
            aria-invalid={verbaleError ? true : undefined}
            aria-describedby={fieldHintId("approve-verbale")}
            className={fieldControl}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}
