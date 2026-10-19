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

import { freshmanApi } from "./freshman.api"
import { freshmanFaqCatalog } from "./freshman.data"
import type { FreshmanContent } from "./types"

export function FreshmanFaqDialog({
  index,
  initialId,
  onClose,
  onSaved,
}: {
  index: number
  initialId: string
  onClose: () => void
  onSaved: (content: FreshmanContent) => void
}) {
  const inputId = useId()
  const [selected, setSelected] = useState(() => freshmanFaqCatalog.find((faq) => faq.id === initialId) ?? null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`FAQ position ${index + 1}`}
      description="Choose a question from the demo catalog. Selecting a featured question swaps its position."
      noun="FAQ selection"
      dirty={selected?.id !== initialId}
      submitLabel="Save demo changes"
      canSubmit={selected !== null && selected.id !== initialId}
      submitOnEnter={false}
      onSubmit={async () => {
        if (selected) onSaved(await freshmanApi.selectFaq(index, selected.id))
      }}
    >
      <FormField label="Question" htmlFor={inputId}>
        <Combobox
          items={freshmanFaqCatalog}
          value={selected}
          onValueChange={setSelected}
          itemToStringLabel={(faq) => faq.question}
          itemToStringValue={(faq) => faq.id}
        >
          <ComboboxInput id={inputId} listLabel="questions" placeholder="Search questions…" />
          <ComboboxContent>
            <ComboboxEmpty>No questions match.</ComboboxEmpty>
            <ComboboxList>
              {(faq: (typeof freshmanFaqCatalog)[number]) => (
                <ComboboxItem key={faq.id} value={faq}>
                  {faq.question}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
      {selected && <p className="text-[13px] text-(--pn-fg-muted)">{selected.answer}</p>}
    </FormDialog>
  )
}
