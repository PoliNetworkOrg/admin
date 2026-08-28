import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Tags } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { errorHasCode } from "@/lib/errors"

import { GroupLabelCard } from "./group-label-card"
import { DEFAULT_GROUP_LABEL_COLOR } from "./group-labels.constants"
import { createGroupLabel, deleteGroupLabel, editGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import type { GroupLabel, GroupLabelFormValues } from "./types"

export function GroupLabelsPage({ loadedGroupLabels }: { loadedGroupLabels: GroupLabel[] }) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const editGroupLabelFn = useServerFn(editGroupLabel)
  const deleteGroupLabelFn = useServerFn(deleteGroupLabel)
  const [groupLabels, setGroupLabels] = useState(loadedGroupLabels)
  const [query, setQuery] = useState("")
  const [draftGroupLabelIds, setDraftGroupLabelIds] = useState<Set<number>>(new Set())
  const draftGroupLabelIdsRef = useRef(draftGroupLabelIds)

  useEffect(() => {
    setGroupLabels((current) => {
      const drafts = current.filter((groupLabel) => draftGroupLabelIdsRef.current.has(groupLabel.id))
      return drafts.length ? [...drafts, ...loadedGroupLabels] : loadedGroupLabels
    })
  }, [loadedGroupLabels])

  const filteredGroupLabels = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return groupLabels
    return groupLabels.filter(
      (groupLabel) =>
        draftGroupLabelIds.has(groupLabel.id) ||
        [groupLabel.label, groupLabel.description].some((value) => value.toLocaleLowerCase().includes(normalized))
    )
  }, [groupLabels, draftGroupLabelIds, query])

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the label list could not be refreshed.")
    }
  }

  function removeDraftGroupLabelId(id: number) {
    const nextDraftIds = new Set(draftGroupLabelIdsRef.current)
    nextDraftIds.delete(id)
    draftGroupLabelIdsRef.current = nextDraftIds
    setDraftGroupLabelIds(nextDraftIds)
  }

  function addGroupLabel() {
    const draft: GroupLabel = {
      id: -Date.now(),
      label: "New label",
      color: DEFAULT_GROUP_LABEL_COLOR,
      description: "",
    }
    setGroupLabels((current) => [draft, ...current])
    const nextDraftIds = new Set(draftGroupLabelIdsRef.current).add(draft.id)
    draftGroupLabelIdsRef.current = nextDraftIds
    setDraftGroupLabelIds(nextDraftIds)
  }

  function cancelDraft(id: number) {
    setGroupLabels((current) => current.filter((groupLabel) => groupLabel.id !== id))
    removeDraftGroupLabelId(id)
  }

  async function saveGroupLabel(id: number, values: GroupLabelFormValues) {
    const draft = draftGroupLabelIdsRef.current.has(id)
    try {
      const saved = draft
        ? await createGroupLabelFn({ data: values })
        : await editGroupLabelFn({ data: { id, ...values } })
      setGroupLabels((current) => current.map((groupLabel) => (groupLabel.id === id ? saved : groupLabel)))
      if (draft) removeDraftGroupLabelId(id)
      toast.success(`Label ${draft ? "created" : "updated"}`)
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      toast.error(groupLabelSaveErrorMessage(cause))
      return false
    }
  }

  async function removeGroupLabel(id: number) {
    if (draftGroupLabelIdsRef.current.has(id)) {
      cancelDraft(id)
      return true
    }

    try {
      await deleteGroupLabelFn({ data: { id } })
      setGroupLabels((current) => current.filter((groupLabel) => groupLabel.id !== id))
      toast.success("Label deleted")
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      if (errorHasCode(cause, "NOT_FOUND")) {
        setGroupLabels((current) => current.filter((groupLabel) => groupLabel.id !== id))
        toast.success("Label deleted")
        void refresh()
        return true
      }
      toast.error("The label could not be deleted. Check your permissions and try again.")
      return false
    }
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Group labels"
        description="Manage the colored labels used to categorize groups on the PoliNetwork website."
        count={filteredGroupLabels.length}
        total={groupLabels.length}
        searchPlaceholder="Search labels…"
        onSearch={setQuery}
        action={
          <Button onClick={addGroupLabel}>
            <Plus data-icon="inline-start" /> Add label
          </Button>
        }
      />

      {filteredGroupLabels.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroupLabels.map((groupLabel) => (
            <GroupLabelCard
              key={groupLabel.id}
              groupLabel={groupLabel}
              draft={draftGroupLabelIds.has(groupLabel.id)}
              initialEditActive={draftGroupLabelIds.has(groupLabel.id)}
              onCancelDraft={() => cancelDraft(groupLabel.id)}
              onDelete={() => removeGroupLabel(groupLabel.id)}
              onSave={(values) => saveGroupLabel(groupLabel.id, values)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Tags}
          title={groupLabels.length ? "No label matches this search" : "No group labels yet"}
          text={
            groupLabels.length
              ? "Try a different label or description."
              : "Add the first label used to categorize groups."
          }
          action={!groupLabels.length ? <Button onClick={addGroupLabel}>Add first label</Button> : undefined}
        />
      )}
    </div>
  )
}
