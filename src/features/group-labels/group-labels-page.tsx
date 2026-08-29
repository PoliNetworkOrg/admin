import { Plus, Tags } from "lucide-react"
import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

import { GroupLabelCard } from "./group-label-card"
import type { GroupLabel } from "./types"
import { useGroupLabelRows } from "./use-group-label-rows"

export function GroupLabelsPage({ loadedGroupLabels }: { loadedGroupLabels: GroupLabel[] }) {
  const { rows, addGroupLabel, cancelDraft, saveGroupLabel, removeGroupLabel } = useGroupLabelRows(loadedGroupLabels)
  const [query, setQuery] = useState("")

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
          <Button onClick={() => addGroupLabel()}>
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
          action={!rows.length ? <Button onClick={() => addGroupLabel()}>Add first label</Button> : undefined}
        />
      )}
    </div>
  )
}
