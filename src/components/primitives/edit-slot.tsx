import { useState } from "react"

import { ConfirmDialog } from "./confirm-dialog"

/**
 * Keeps one inline edit open per page. Starting another edit while the current one is dirty asks
 * "Discard changes?"; render `discardDialog` once.
 */
export function useEditSlot<Id>(noun: string, saving = false) {
  const [editingId, setEditingId] = useState<Id | null>(null)
  const [queued, setQueued] = useState<{ id: Id | null; onSwitch?: () => void } | null>(null)

  /**
   * Switches the open edit to `id` (`null` closes it). `onSwitch` runs once the switch happens: right away, or
   * after the user confirms "Discard" — so a choice that needed the confirmation (another category) is kept.
   */
  function start(id: Id | null, currentIsDirty: boolean, onSwitch?: () => void) {
    if (saving) return
    if (editingId !== null && currentIsDirty) {
      setQueued({ id, onSwitch })
      return
    }
    setEditingId(id)
    onSwitch?.()
  }

  const discardDialog = (
    <ConfirmDialog
      open={queued !== null}
      onOpenChange={(open) => {
        if (!open) setQueued(null)
      }}
      title="Discard changes?"
      description={`Your edits to this ${noun} will be lost.`}
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onConfirm={async () => {
        setEditingId(queued?.id ?? null)
        queued?.onSwitch?.()
      }}
    />
  )

  return { editingId, start, stop: () => setEditingId(null), discardDialog }
}
