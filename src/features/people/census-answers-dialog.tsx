import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"

import { FormDialog, InlineAlert, Spinner } from "@/components/primitives"

import { getCensusAnswers } from "./people.functions"

/** A census year's full answers, as the person gave them: HR and the Direttivo only. */
export function CensusAnswersDialog({
  open,
  onOpenChange,
  personId,
  name,
  year,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: string
  name: string
  year: string
}) {
  const load = useServerFn(getCensusAnswers)
  const [answers, setAnswers] = useState<{ question: string; answer: string }[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    load({ data: { personId, year } }).then(
      (result) => {
        if (current) setAnswers(result)
      },
      (caught) => {
        console.error(caught)
        if (current) setFailed(true)
      }
    )
    return () => {
      current = false
    }
  }, [load, personId, year])

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${year} answers`}
      description={name}
      noun="answers"
      dirty={false}
      onSubmit={() => onOpenChange(false)}
    >
      {failed ? <InlineAlert>Couldn't load the answers. Close and try again.</InlineAlert> : null}
      {answers === null && !failed ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-(--pn-fg-muted)">
          <Spinner />
          Loading answers…
        </p>
      ) : null}
      {answers ? (
        <dl className="flex flex-col divide-y divide-(--pn-line)">
          {answers.map((entry) => (
            <div key={entry.question} className="flex flex-col gap-0.5 py-2.5 first:pt-0">
              <dt className="text-xs text-(--pn-fg-muted)">{entry.question}</dt>
              <dd className="text-[14px]">{entry.answer}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </FormDialog>
  )
}
