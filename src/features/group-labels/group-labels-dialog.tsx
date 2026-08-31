import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { isSameGroupLabel } from "@/features/group-labels/group-labels.constants"
import { tagGroup, untagGroup } from "@/features/group-labels/group-labels.functions"
import { LabelTreeSelector } from "@/features/group-labels/label-tree-selector"
import type { TgGroupLabel } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"

/** Works for both Telegram and WhatsApp groups — labels are a shared, platform-agnostic system. */
export function GroupLabelsDialog({
  group,
  allLabels,
  currentLabels,
  onClose,
  onSaved,
}: {
  group: { id: number; title: string } | null
  allLabels: TgGroupLabel[]
  currentLabels: TgGroupLabel[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const tagGroupFn = useServerFn(tagGroup)
  const untagGroupFn = useServerFn(untagGroup)
  const [selected, setSelected] = useState<TgGroupLabel[]>(currentLabels)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const open = group !== null

  // Resets the working selection only when a different group is opened, not on every relations refresh
  // (currentLabels is intentionally excluded: it gets a new array identity on every parent render) — and
  // keyed on the group's id rather than the `group` object itself, since every call site constructs a new
  // `{ id, title }` literal inline on every render, which would otherwise re-fire this effect (discarding
  // any in-progress, unsaved selection) on every unrelated re-render while the dialog is open.
  useEffect(() => {
    if (group) {
      setSelected(currentLabels)
      setError("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id])

  const added = selected.filter((label) => !currentLabels.some((current) => isSameGroupLabel(current, label)))
  const removed = currentLabels.filter((label) => !selected.some((next) => isSameGroupLabel(next, label)))
  const dirty = added.length > 0 || removed.length > 0

  function toggleManyLabels(labels: TgGroupLabel[], select: boolean) {
    setSelected((current) => {
      if (select) {
        const toAdd = labels.filter((label) => !current.some((existing) => isSameGroupLabel(existing, label)))
        return [...current, ...toAdd]
      }
      return current.filter((existing) => !labels.some((label) => isSameGroupLabel(existing, label)))
    })
  }

  async function save() {
    if (!group || !dirty || pending) return
    setPending(true)
    setError("")
    try {
      const results = await Promise.allSettled([
        ...added.map((label) => tagGroupFn({ data: { groupId: group.id, label: label.label } })),
        ...removed.map((label) => untagGroupFn({ data: { groupId: group.id, label: label.label } })),
      ])
      const failed = results.filter((result) => result.status === "rejected").length
      if (failed > 0) {
        // Some of these may have already applied even though others failed — refresh so the underlying
        // data (and this dialog, next time it opens) reflects what's actually saved, instead of silently
        // implying nothing happened.
        await onSaved()
        setError(
          `${failed} of ${results.length} label change(s) couldn't be saved — some may have already applied. Check the group's labels and try again.`
        )
        return
      }
      toast.success(`Labels updated for ${group.title}.`)
      onClose()
      await onSaved()
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group labels could not be updated. Check your permissions and try again."))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit labels</DialogTitle>
          <DialogDescription>{group ? `Choose the labels that apply to ${group.title}.` : null}</DialogDescription>
        </DialogHeader>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Labels</p>
          {allLabels.length ? (
            <LabelTreeSelector allLabels={allLabels} selected={selected} onToggleMany={toggleManyLabels} />
          ) : (
            <p className="text-sm text-muted-foreground">No labels have been created yet.</p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !dirty} onClick={() => void save()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            Save labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
