import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Tags } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

import { GroupLabelCard } from "./group-label-card"
import { DEFAULT_GROUP_LABEL_COLOR } from "./group-labels.constants"
import { createGroupLabel, deleteGroupLabel, editGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import type { GroupLabel, GroupLabelFormValues } from "./types"

type GroupLabelRow = { key: string; groupLabel: GroupLabel; draft: boolean }

function toRows(groupLabels: GroupLabel[]): GroupLabelRow[] {
  return groupLabels.map((groupLabel) => ({ key: groupLabel.label, groupLabel, draft: false }))
}

export function GroupLabelsPage({ loadedGroupLabels }: { loadedGroupLabels: GroupLabel[] }) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const editGroupLabelFn = useServerFn(editGroupLabel)
  const deleteGroupLabelFn = useServerFn(deleteGroupLabel)
  const [rows, setRows] = useState<GroupLabelRow[]>(() => toRows(loadedGroupLabels))
  const [query, setQuery] = useState("")

  useEffect(() => {
    setRows((current) => {
      const drafts = current.filter((row) => row.draft)
      const real = toRows(loadedGroupLabels)
      return drafts.length ? [...drafts, ...real] : real
    })
  }, [loadedGroupLabels])

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return rows
    return rows.filter(
      (row) =>
        row.draft ||
        [row.groupLabel.label, row.groupLabel.description ?? ""].some((value) =>
          value.toLocaleLowerCase().includes(normalized)
        )
    )
  }, [rows, query])

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the label list could not be refreshed.")
    }
  }

  function addGroupLabel() {
    const draft: GroupLabelRow = {
      key: `draft-${crypto.randomUUID()}`,
      draft: true,
      groupLabel: {
        label: "",
        color: DEFAULT_GROUP_LABEL_COLOR,
        description: "",
        createdBy: 0,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: null,
      },
    }
    setRows((current) => [draft, ...current])
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

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Group labels"
        description="Manage the colored labels used to categorize groups on the PoliNetwork website."
        count={filteredRows.length}
        total={rows.length}
        searchPlaceholder="Search labels…"
        onSearch={setQuery}
        action={
          <Button onClick={addGroupLabel}>
            <Plus data-icon="inline-start" /> Add label
          </Button>
        }
      />

      {filteredRows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((row) => (
            <GroupLabelCard
              key={row.key}
              groupLabel={row.groupLabel}
              draft={row.draft}
              initialEditActive={row.draft}
              onCancelDraft={() => cancelDraft(row.key)}
              onDelete={() => removeGroupLabel(row)}
              onSave={(values) => saveGroupLabel(row, values)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Tags}
          title={rows.length ? "No label matches this search" : "No group labels yet"}
          text={
            rows.length ? "Try a different label or description." : "Add the first label used to categorize groups."
          }
          action={!rows.length ? <Button onClick={addGroupLabel}>Add first label</Button> : undefined}
        />
      )}
    </div>
  )
}
