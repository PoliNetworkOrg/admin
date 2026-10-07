import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useId } from "react"

import { FormDialog } from "@/components/primitives"
import { appToast } from "@/components/shell"

import { DEFAULT_GROUP_LABEL_COLOR, GROUP_LABEL_MAX } from "./group-labels.constants"
import { createGroupLabel, createReleaseLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import { LabelNameField, useLabelName, useResetOnOpen } from "./label-name-field"
import { RELEASE_LABEL_PREFIX } from "./label-tree"

export type TagKind = "attribute" | "publication"

const copy = {
  attribute: {
    title: "Add attribute",
    description:
      "A permanent attribute, like a language or campus. Use Publications to prepare a batch for publishing.",
    placeholder: "e.g. Italian, Bovisa",
    toast: (name: string) => `Attribute ${name} created.`,
  },
  publication: {
    title: "Create publication",
    description:
      "Create a batch of groups to publish together. Publishing makes its groups visible and clears only the batch label; categories and attributes remain.",
    placeholder: "e.g. 2026-27",
    toast: (name: string) => `Publication ${name} created.`,
  },
} satisfies Record<
  TagKind,
  { title: string; description: string; placeholder: string; toast: (name: string) => string }
>

type AddTagDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: TagKind
}

/** Flat tags: a permanent attribute, or a `release-` publication batch. */
export function AddTagDialog({ open, onOpenChange, kind }: AddTagDialogProps) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const createReleaseLabelFn = useServerFn(createReleaseLabel)
  const nameId = useId()
  const name = useLabelName(kind)
  const text = copy[kind]

  useResetOnOpen(open, () => name.reset())

  async function submit() {
    if (!name.check()) return
    const values = { color: DEFAULT_GROUP_LABEL_COLOR, description: "" }
    try {
      if (kind === "publication") await createReleaseLabelFn({ data: { name: name.trimmed, ...values } })
      else await createGroupLabelFn({ data: { label: name.trimmed, ...values } })
    } catch (cause) {
      console.error(cause)
      throw new Error(groupLabelSaveErrorMessage(cause))
    }
    appToast.success(text.toast(name.trimmed))
    onOpenChange(false)
    await router.invalidate({ sync: true })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={text.title}
      description={text.description}
      noun={kind}
      dirty={name.trimmed !== ""}
      submitLabel={text.title}
      canSubmit={name.trimmed !== ""}
      onSubmit={submit}
    >
      <LabelNameField
        id={nameId}
        field={name}
        placeholder={text.placeholder}
        maxLength={kind === "publication" ? GROUP_LABEL_MAX - RELEASE_LABEL_PREFIX.length : GROUP_LABEL_MAX}
      />
    </FormDialog>
  )
}
