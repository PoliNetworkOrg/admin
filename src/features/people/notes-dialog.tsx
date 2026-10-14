import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { fieldControl, FormDialog, FormField } from "@/components/primitives"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { errorMessage, useRefreshAfter } from "./people-hooks"
import { setPersonNote } from "./people-write.functions"

const SAVE_ERROR = "The note could not be saved. Try again."

/** HR notes on a record: visible to the Direttivo and HR only. */
export function NotesDialog({
  open,
  onOpenChange,
  personId,
  notes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId: string
  notes: string | null
}) {
  const save = useServerFn(setPersonNote)
  const refresh = useRefreshAfter()
  const [value, setValue] = useState(notes ?? "")

  async function submit() {
    try {
      await save({ data: { id: personId, note: value.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(caught instanceof Error ? errorMessage(caught, SAVE_ERROR) : SAVE_ERROR, { cause: caught })
    }
    await refresh("Note saved.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="HR notes"
      description="Visible to the Direttivo and HR only."
      noun="note"
      dirty={value !== (notes ?? "")}
      submitLabel="Save note"
      onSubmit={submit}
    >
      <FormField label="Note" htmlFor="person-note" counter={{ length: value.length, max: 2000 }}>
        <Textarea
          id="person-note"
          value={value}
          maxLength={2000}
          onChange={(event) => setValue(event.target.value)}
          className={cn(fieldControl, "min-h-32")}
        />
      </FormField>
    </FormDialog>
  )
}
