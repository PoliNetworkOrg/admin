import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft } from "lucide-react"
import { useId, useMemo, useState } from "react"

import { buttonMotion, FormDialog, NavCard } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { DEFAULT_GROUP_LABEL_COLOR } from "./group-labels.constants"
import { createGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import { focusFieldSoon, LabelNameField, useLabelName, useResetOnOpen } from "./label-name-field"
import {
  buildCategoryRootTree,
  countCategoryDescendants,
  formatLabelSegment,
  isCategoryLabel,
  labelPathToUrlSegments,
} from "./label-tree"
import type { GroupLabel } from "./types"

type AddCategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  labels: GroupLabel[]
}

/**
 * Two steps: pick the fixed root (Didattica / Extra), then name the new category; navigates to it on success.
 * There is no "add a root" action: only a code change (`CATEGORY_ROOTS`) can introduce one.
 */
export function AddCategoryDialog({ open, onOpenChange, labels }: AddCategoryDialogProps) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const nameId = useId()
  const [root, setRoot] = useState<string | null>(null)
  const name = useLabelName("category")
  const roots = useMemo(() => buildCategoryRootTree(labels.filter((label) => isCategoryLabel(label.label))), [labels])

  useResetOnOpen(open, () => {
    setRoot(null)
    name.reset()
  })

  const rootTitle = root === null ? "" : formatLabelSegment(root)

  async function submit() {
    if (root === null || !name.check()) return
    const path = `${root}.${name.trimmed}`
    try {
      await createGroupLabelFn({ data: { label: path, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
    } catch (cause) {
      console.error(cause)
      throw new Error(groupLabelSaveErrorMessage(cause))
    }
    appToast.success(`${formatLabelSegment(name.trimmed)} created under ${rootTitle}.`)
    onOpenChange(false)
    await router.navigate({
      to: "/dashboard/web/groups-by-label/$",
      params: { _splat: labelPathToUrlSegments(path).join("/") },
    })
    await router.invalidate({ sync: true })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add category"
      description={
        root === null
          ? "Which top-level category does this belong under?"
          : `Creates a new category under ${rootTitle}.`
      }
      noun="category"
      dirty={name.trimmed !== ""}
      submitLabel={root === null ? undefined : "Add category"}
      canSubmit={root !== null && name.trimmed !== ""}
      onSubmit={submit}
      footerStart={
        root === null ? undefined : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setRoot(null)
              name.reset()
            }}
            className={buttonMotion}
          >
            <ArrowLeft aria-hidden data-icon="inline-start" />
            Back
          </Button>
        )
      }
    >
      {root === null ? (
        <div className="grid gap-3 min-[480px]:grid-cols-2">
          {roots.map((candidate) => (
            <NavCard
              key={candidate.path}
              title={formatLabelSegment(candidate.segment)}
              count={countCategoryDescendants(candidate)}
              noun="category"
              onClick={() => {
                setRoot(candidate.path)
                focusFieldSoon(nameId)
              }}
            />
          ))}
        </div>
      ) : (
        <LabelNameField id={nameId} field={name} placeholder="sub-category" />
      )}
    </FormDialog>
  )
}
