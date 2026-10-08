import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import { FormDialog, InlineAlert, LabelTreeSelector } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { tagGroup, untagGroup } from "@/features/group-labels/group-labels.functions"
import type { GroupLabel } from "@/features/group-labels/types"
import type { GroupWithLabels } from "@/lib/api/types"

type GroupLabelsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Telegram and WhatsApp ids are independent sequences, so the platform is part of the identity. */
  group: { type: GroupWithLabels["type"]; id: number; title: string }
  allLabels: GroupLabel[]
  /** The group's saved label paths. */
  currentLabels: string[]
  /** Reloads the route data; runs after a save, including a partial one. */
  onSaved: () => Promise<void>
}

/** "Edit labels": picks the group's labels; Save is enabled only once the set changes. */
export function GroupLabelsDialog({
  open,
  onOpenChange,
  group,
  allLabels,
  currentLabels,
  onSaved,
}: GroupLabelsDialogProps) {
  const tagGroupFn = useServerFn(tagGroup)
  const untagGroupFn = useServerFn(untagGroup)
  const [selected, setSelected] = useState(currentLabels)
  const [partialError, setPartialError] = useState<string | null>(null)
  const [openedFor, setOpenedFor] = useState<string | null>(null)

  // Start from the group's saved labels every time the dialog opens, not on every refresh while it is open.
  const session = open ? `${group.type}:${group.id}` : null
  if (session !== openedFor) {
    setOpenedFor(session)
    if (session !== null) {
      setSelected(currentLabels)
      setPartialError(null)
    }
  }

  const added = selected.filter((label) => !currentLabels.includes(label))
  const removed = currentLabels.filter((label) => !selected.includes(label))
  const dirty = added.length > 0 || removed.length > 0

  function toggleMany(labels: GroupLabel[], select: boolean) {
    const paths = labels.map((label) => label.label)
    setSelected((previous) =>
      select
        ? [...previous, ...paths.filter((path) => !previous.includes(path))]
        : previous.filter((path) => !paths.includes(path))
    )
  }

  async function save() {
    setPartialError(null)
    const ref = { groupId: group.id, type: group.type }
    const results = await Promise.allSettled([
      ...added.map((label) => tagGroupFn({ data: { ...ref, label } })),
      ...removed.map((label) => untagGroupFn({ data: { ...ref, label } })),
    ])
    const failed = results.filter((result) => result.status === "rejected").length
    if (failed > 0) {
      // Some changes may have applied: reload so the table, and this dialog next time, show what is saved.
      await onSaved()
      setPartialError(
        `${failed} of ${results.length} label change(s) couldn't be saved — some may have already applied. Check the group's labels and try again.`
      )
      return
    }
    await onSaved()
    appToast.success(`Labels updated for ${group.title}.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit labels"
      description={`Choose the labels that apply to ${group.title}.`}
      noun="group"
      dirty={dirty}
      canSubmit={dirty}
      submitLabel="Save labels"
      onSubmit={save}
      notice={partialError && <InlineAlert tone="warning">{partialError}</InlineAlert>}
    >
      <LabelTreeSelector allLabels={allLabels} selected={selected} onToggleMany={toggleMany} />
    </FormDialog>
  )
}
