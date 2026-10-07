import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useId } from "react"

import { FormDialog, KeyValueList } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { pluralize } from "@/lib/format"

import { renameGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import { LabelNameField, useLabelName, useResetOnOpen } from "./label-name-field"
import { formatLabelBreadcrumb } from "./label-tree"
import type { GroupLabel } from "./types"

type RenameLabelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dotted category path; may be a grouping node without a label row of its own. */
  path: string
  labels: GroupLabel[]
  /** Called with the new path after a successful rename (e.g. to carry expanded tree state over). */
  onRenamed?: (newPath: string) => void
}

/** Renames the last segment of a category; every label nested under it is re-pathed too. */
export function RenameLabelDialog({ open, onOpenChange, path, labels, onRenamed }: RenameLabelDialogProps) {
  const router = useRouter()
  const renameGroupLabelFn = useServerFn(renameGroupLabel)
  const nameId = useId()
  const segments = path.split(".")
  const segment = segments.at(-1) ?? path
  const parent = segments.slice(0, -1).join(".")
  const name = useLabelName("category", segment)
  const affected = labels.filter((label) => label.label === path || label.label.startsWith(`${path}.`))
  const nestedCount = affected.filter((label) => label.label !== path).length

  useResetOnOpen(open, () => name.reset(segment))

  const breadcrumb = formatLabelBreadcrumb(path)
  const changed = name.trimmed !== "" && name.trimmed !== segment
  const newPath = parent ? `${parent}.${name.trimmed}` : name.trimmed
  const previewable = changed && !name.trimmed.includes(".")

  function renameAll(renames: { label: GroupLabel; from: string; to: string }[]) {
    return Promise.allSettled(
      renames.map(({ label, from, to }) =>
        renameGroupLabelFn({
          data: { label: from, newLabel: to, color: label.color, description: label.description ?? "" },
        })
      )
    )
  }

  async function submit() {
    if (!name.check()) return
    // The backend renames one label at a time with no transaction, so a cascade can fail partway. Every rename is
    // settled first and, on any failure, the successful ones are renamed back: all or nothing for the admin.
    const renames = affected.map((label) => ({
      label,
      from: label.label,
      to: newPath + label.label.slice(path.length),
    }))
    const results = await renameAll(renames)
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failure) {
      console.error(failure.reason)
      const succeeded = renames.filter((_, index) => results[index]?.status === "fulfilled")
      if (succeeded.length === 0) throw new Error(groupLabelSaveErrorMessage(failure.reason))
      const rollback = await renameAll(succeeded.map(({ label, from, to }) => ({ label, from: to, to: from })))
      await router.invalidate({ sync: true })
      throw new Error(
        rollback.some((result) => result.status === "rejected")
          ? "The rename failed partway and some labels couldn't be rolled back automatically. Check the category tree for leftover names."
          : "The rename couldn't be completed and was rolled back. Check your permissions and try again."
      )
    }
    appToast.success(`Renamed to ${formatLabelBreadcrumb(newPath)}.`)
    onOpenChange(false)
    onRenamed?.(newPath)
    await router.invalidate({ sync: true })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename category"
      description={
        nestedCount > 0
          ? `Renames ${breadcrumb} and the ${pluralize(nestedCount, "label")} nested under it, keeping their colors, descriptions, and tagged groups.`
          : `Renaming ${breadcrumb} keeps its color, description, and any groups already tagged with it.`
      }
      noun="category"
      dirty={changed}
      submitLabel="Rename"
      canSubmit={changed}
      onSubmit={submit}
    >
      <LabelNameField id={nameId} field={name} />
      <KeyValueList items={[{ key: "Will become", value: previewable ? newPath : null, mono: true }]} />
    </FormDialog>
  )
}
