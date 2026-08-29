import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LabelTreeSelector } from "@/features/group-labels/label-tree-selector"
import type { TgGroupLabel, WaGroup } from "@/lib/api/types"

/**
 * TODO: this only updates in-memory state for the current page load. There's no `wa_group_label_relations`
 * table (or platform-aware version of the tg one) yet, so nothing is persisted to the backend.
 */
export function WhatsappGroupLabelsDialog({
  group,
  allLabels,
  currentLabels,
  onClose,
  onSave,
}: {
  group: WaGroup | null
  allLabels: TgGroupLabel[]
  currentLabels: TgGroupLabel[]
  onClose: () => void
  onSave: (labels: TgGroupLabel[]) => void
}) {
  const [selected, setSelected] = useState<TgGroupLabel[]>(currentLabels)
  const open = group !== null

  useEffect(() => {
    if (group) setSelected(currentLabels)
    // Resets only when a different group is opened, not on every render of currentLabels.
  }, [group])

  function toggleMany(labels: TgGroupLabel[], select: boolean) {
    setSelected((current) => {
      if (select) {
        const toAdd = labels.filter((label) => !current.some((existing) => existing.label === label.label))
        return [...current, ...toAdd]
      }
      return current.filter((existing) => !labels.some((label) => existing.label === label.label))
    })
  }

  function save() {
    onSave(selected)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit labels</DialogTitle>
          <DialogDescription>
            {group ? `Choose the labels that apply to ${group.title}.` : null} Not saved to the backend yet — this is a
            placeholder until WhatsApp groups get real label storage.
          </DialogDescription>
        </DialogHeader>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Labels</p>
          {allLabels.length ? (
            <LabelTreeSelector allLabels={allLabels} selected={selected} onToggleMany={toggleMany} />
          ) : (
            <p className="text-sm text-muted-foreground">No labels have been created yet.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
