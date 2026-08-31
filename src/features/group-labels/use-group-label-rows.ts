import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/lib/errors"

import { deleteGroupLabel, editGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import type { GroupLabel, GroupLabelEditValues } from "./types"

export function useGroupLabelRows(loadedGroupLabels: GroupLabel[]) {
  const router = useRouter()
  const editGroupLabelFn = useServerFn(editGroupLabel)
  const deleteGroupLabelFn = useServerFn(deleteGroupLabel)
  const [labels, setLabels] = useState<GroupLabel[]>(loadedGroupLabels)

  useEffect(() => {
    setLabels(loadedGroupLabels)
  }, [loadedGroupLabels])

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the label list could not be refreshed.")
    }
  }

  async function saveGroupLabel(groupLabel: GroupLabel, values: GroupLabelEditValues) {
    try {
      const saved = await editGroupLabelFn({
        data: { label: groupLabel.label, color: values.color, description: values.description },
      })
      setLabels((current) => current.map((current_) => (current_.label === saved.label ? saved : current_)))
      toast.success("Label updated")
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      toast.error(groupLabelSaveErrorMessage(cause))
      return false
    }
  }

  async function removeGroupLabel(groupLabel: GroupLabel) {
    try {
      await deleteGroupLabelFn({ data: { label: groupLabel.label } })
      setLabels((current) => current.filter((current_) => current_.label !== groupLabel.label))
      toast.success("Label deleted")
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      toast.error(errorMessage(cause, "The label could not be deleted. Check your permissions and try again."))
      return false
    }
  }

  return { labels, saveGroupLabel, removeGroupLabel }
}
