import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { DEFAULT_GROUP_LABEL_COLOR } from "./group-labels.constants"
import { createGroupLabel, deleteGroupLabel, editGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import type { GroupLabel, GroupLabelFormValues } from "./types"

export type GroupLabelRow = { key: string; groupLabel: GroupLabel; draft: boolean }

function toRows(groupLabels: GroupLabel[]): GroupLabelRow[] {
  return groupLabels.map((groupLabel) => ({ key: groupLabel.label, groupLabel, draft: false }))
}

export function useGroupLabelRows(loadedGroupLabels: GroupLabel[]) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const editGroupLabelFn = useServerFn(editGroupLabel)
  const deleteGroupLabelFn = useServerFn(deleteGroupLabel)
  const [rows, setRows] = useState<GroupLabelRow[]>(() => toRows(loadedGroupLabels))

  useEffect(() => {
    setRows((current) => {
      const drafts = current.filter((row) => row.draft)
      const real = toRows(loadedGroupLabels)
      return drafts.length ? [...drafts, ...real] : real
    })
  }, [loadedGroupLabels])

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the label list could not be refreshed.")
    }
  }

  function addGroupLabel(prefillLabel = "") {
    const key = `draft-${crypto.randomUUID()}`
    const draft: GroupLabelRow = {
      key,
      draft: true,
      groupLabel: {
        label: prefillLabel,
        color: DEFAULT_GROUP_LABEL_COLOR,
        description: "",
        createdBy: 0,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: null,
      },
    }
    setRows((current) => [draft, ...current])
    return key
  }

  function cancelDraft(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  async function saveGroupLabel(row: GroupLabelRow, values: GroupLabelFormValues) {
    try {
      const saved = row.draft
        ? await createGroupLabelFn({ data: values })
        : await editGroupLabelFn({
            data: { label: row.groupLabel.label, color: values.color, description: values.description },
          })
      setRows((current) =>
        current.map((current_) =>
          current_.key === row.key ? { key: saved.label, groupLabel: saved, draft: false } : current_
        )
      )
      toast.success(`Label ${row.draft ? "created" : "updated"}`)
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      toast.error(groupLabelSaveErrorMessage(cause))
      return false
    }
  }

  async function removeGroupLabel(row: GroupLabelRow) {
    if (row.draft) {
      cancelDraft(row.key)
      return true
    }

    try {
      await deleteGroupLabelFn({ data: { label: row.groupLabel.label } })
      setRows((current) => current.filter((current_) => current_.key !== row.key))
      toast.success("Label deleted")
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      toast.error("The label could not be deleted. Check your permissions and try again.")
      return false
    }
  }

  return { rows, addGroupLabel, cancelDraft, saveGroupLabel, removeGroupLabel }
}
