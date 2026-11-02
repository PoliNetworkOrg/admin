import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Ellipsis, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  ConfirmDialog,
  fieldControl,
  FormDialog,
  FormField,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Input } from "@/components/ui/input"

import { deleteDraft, renameDraft } from "./regulations-draft.functions"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import type { Draft } from "./regulations.contract"

const TITLE_MAX = 120

/**
 * A draft's own actions, as a "More actions" menu for the page header: rename it and, while it's a bozza, delete it.
 * Renders nothing when the viewer may do neither.
 */
export function DraftActions({ draft }: { draft: Pick<Draft, "id" | "title" | "can"> }) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const renameKey = useOpenGeneration(renameOpen)
  if (!draft.can.rename && !draft.can.delete) return null
  return (
    <>
      <Menu>
        <MenuTrigger
          render={<IconButton label="Altre azioni" icon={Ellipsis} appearance="boxed" className="size-10" />}
        />
        <MenuContent>
          {draft.can.rename ? (
            <MenuItem onClick={() => setRenameOpen(true)}>
              <Pencil />
              Rinomina
            </MenuItem>
          ) : null}
          {draft.can.rename && draft.can.delete ? <MenuSeparator /> : null}
          {draft.can.delete ? (
            <MenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              Elimina bozza
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
      {draft.can.rename ? (
        <RenameDraftDialog key={renameKey} open={renameOpen} onOpenChange={setRenameOpen} draft={draft} />
      ) : null}
      {draft.can.delete ? <DeleteDraftDialog open={deleteOpen} onOpenChange={setDeleteOpen} draft={draft} /> : null}
    </>
  )
}

function RenameDraftDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: Pick<Draft, "id" | "title">
}) {
  const rename = useServerFn(renameDraft)
  const refresh = useRefreshAfter()
  const [title, setTitle] = useState(draft.title)
  const [submitted, setSubmitted] = useState(false)
  const error = submitted && !title.trim() ? "Scrivi un titolo." : undefined

  async function submit() {
    setSubmitted(true)
    if (!title.trim()) return
    if (title.trim() === draft.title) {
      onOpenChange(false)
      return
    }
    try {
      await rename({ data: { draftId: draft.id, title: title.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile rinominare la bozza. Riprova."), { cause: caught })
    }
    await refresh("Bozza rinominata.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      locale="it"
      open={open}
      onOpenChange={onOpenChange}
      title="Rinomina la bozza"
      noun="bozza"
      dirty={title !== draft.title}
      submitLabel="Rinomina"
      onSubmit={submit}
    >
      <FormField label="Titolo" htmlFor="draft-title" error={error} counter={{ length: title.length, max: TITLE_MAX }}>
        <Input
          id="draft-title"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={fieldControl}
        />
      </FormField>
    </FormDialog>
  )
}

function DeleteDraftDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: Pick<Draft, "id" | "title">
}) {
  const remove = useServerFn(deleteDraft)
  const navigate = useNavigate()

  async function confirm() {
    try {
      await remove({ data: { draftId: draft.id } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile eliminare la bozza. Riprova."), { cause: caught })
    }
    // The draft's pages are gone: leave for Bozze, which loads the list again.
    await navigate({ to: "/dashboard/regulations/drafts" })
    appToast.success("Bozza eliminata.")
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminare la bozza?"
      description={`«${draft.title}» sparisce da Bozze per tutti i membri, con i suoi commenti. Le versioni pubblicate non cambiano.`}
      confirmLabel="Elimina bozza"
      cancelLabel="Annulla"
      onConfirm={confirm}
    />
  )
}
