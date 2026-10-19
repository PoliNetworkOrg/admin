import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  FormDialog,
  FormField,
} from "@/components/primitives"

import { selectFreshmanFaq } from "./freshman.functions"
import type { FreshmanFaq } from "./types"

export function FreshmanFaqDialog({
  index,
  open,
  catalog,
  initialId,
  onClose,
  onSaved,
}: {
  index: number
  open: boolean
  catalog: FreshmanFaq[]
  initialId: number
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const selectFreshmanFaqFn = useServerFn(selectFreshmanFaq)
  const inputId = useId()
  const [selected, setSelected] = useState(() => catalog.find((faq) => faq.faqId === initialId) ?? null)
  return (
    <FormDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`FAQ position ${index + 1}`}
      description="Choose a question from the FAQ catalog. Selecting a featured question swaps its position."
      noun="FAQ selection"
      dirty={selected !== null && selected.faqId !== initialId}
      submitLabel="Save selection"
      canSubmit={selected !== null && selected.faqId !== initialId}
      submitOnEnter={false}
      onSubmit={async () => {
        if (!selected) return
        await selectFreshmanFaqFn({ data: { position: index, faqId: selected.faqId } })
        await onSaved()
      }}
    >
      <FormField label="Question" htmlFor={inputId}>
        <Combobox
          items={catalog}
          value={selected}
          onValueChange={setSelected}
          itemToStringLabel={(faq) => faq.titleIt}
          itemToStringValue={(faq) => String(faq.faqId)}
        >
          <ComboboxInput id={inputId} listLabel="questions" placeholder="Search questions…" />
          <ComboboxContent>
            <ComboboxEmpty>No questions match.</ComboboxEmpty>
            <ComboboxList>
              {(faq: FreshmanFaq) => (
                <ComboboxItem key={faq.faqId} value={faq}>
                  {faq.titleIt}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
      {selected && <p className="text-[13px] text-(--pn-fg-muted)">{selected.descriptionIt}</p>}
    </FormDialog>
  )
}
