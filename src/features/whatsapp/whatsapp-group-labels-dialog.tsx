import { LoaderCircle } from "lucide-react"
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
 * TODO: `onSave` writes to an in-memory placeholder store (see groups.functions.ts), not a real
 * `wa_group_label_relations` table — it resets if the server restarts.
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
  onSave: (labels: TgGroupLabel[]) => Promise<void>
}) {
  const [selected, setSelected] = useState<TgGroupLabel[]>(currentLabels)
  const [pending, setPending] = useState(false)
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

  async function save() {
    if (pending) return
    setPending(true)
    try {
      await onSave(selected)
      onClose()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && !nextOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit labels</DialogTitle>
          <DialogDescription>
            {group ? `Choose the labels that apply to ${group.title}.` : null} Stored in memory only for now — it resets
            if the server restarts.
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
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={() => void save()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            Save labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
