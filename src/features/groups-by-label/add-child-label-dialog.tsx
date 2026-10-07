import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useId } from "react"

import { FormDialog, KeyValueList } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel } from "@/features/group-labels/group-labels.functions"
import { groupLabelSaveErrorMessage } from "@/features/group-labels/group-labels.validation"
import { LabelNameField, useLabelName, useResetOnOpen } from "@/features/group-labels/label-name-field"
import { formatLabelBreadcrumb, labelPathToUrlSegments } from "@/features/group-labels/label-tree"

type AddChildLabelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Parent category path. */
  path: string
  /** The category page jumps into the new branch; the Labels page stays put. */
  navigateOnSuccess?: boolean
  onCreated?: (childPath: string) => void
}

export function AddChildLabelDialog({
  open,
  onOpenChange,
  path,
  navigateOnSuccess = false,
  onCreated,
}: AddChildLabelDialogProps) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const nameId = useId()
  const name = useLabelName("category")

  useResetOnOpen(open, () => name.reset())

  const childPath = `${path}.${name.trimmed}`
  const previewable = name.trimmed !== "" && !name.trimmed.includes(".")

  async function submit() {
    if (!name.check()) return
    try {
      await createGroupLabelFn({ data: { label: childPath, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
    } catch (cause) {
      console.error(cause)
      throw new Error(groupLabelSaveErrorMessage(cause))
    }
    await router.invalidate({ sync: true })
    appToast.success(`${childPath} created.`)
    onOpenChange(false)
    onCreated?.(childPath)
    if (navigateOnSuccess) {
      await router.navigate({
        to: "/dashboard/web/groups-by-label/$",
        params: { _splat: labelPathToUrlSegments(childPath).join("/") },
      })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add sub-category"
      description={`Creates a new category under ${formatLabelBreadcrumb(path)}.`}
      noun="category"
      dirty={name.trimmed !== ""}
      submitLabel="Add category"
      canSubmit={name.trimmed !== ""}
      onSubmit={submit}
    >
      <LabelNameField id={nameId} field={name} placeholder="sub-category" />
      <KeyValueList items={[{ key: "Will be created as", value: previewable ? childPath : null, mono: true }]} />
    </FormDialog>
  )
}
