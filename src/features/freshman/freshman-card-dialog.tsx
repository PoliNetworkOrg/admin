import { useId, useState } from "react"

import { fieldControl, fieldHintId, FormDialog, FormField } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { FreshmanIconPicker } from "./freshman-icon"
import { freshmanApi } from "./freshman.api"
import { freshmanCardInput } from "./freshman.validation"
import type { FreshmanCard, FreshmanCardInput, FreshmanCardErrors, FreshmanContent } from "./types"

export function FreshmanCardDialog({
  card,
  section,
  onClose,
  onSaved,
}: {
  card: FreshmanCard
  section: "resources" | "telegram"
  onClose: () => void
  onSaved: (content: FreshmanContent) => void
}) {
  const fieldPrefix = useId()
  const initial: FreshmanCardInput = {
    title: card.title,
    description: card.description,
    href: card.href,
    icon: card.icon,
  }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FreshmanCardErrors>({})
  const dirty =
    values.title !== initial.title ||
    values.description !== initial.description ||
    values.href !== initial.href ||
    values.icon !== initial.icon

  async function submit() {
    const parsed = freshmanCardInput.safeParse(values)
    const nextErrors: FreshmanCardErrors = {}
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (field === "title" || field === "description" || field === "href" || field === "icon")
          nextErrors[field] = issue.message
      }
    if (section === "telegram" && !values.href.trim()) nextErrors.href = "Enter a group link."
    setErrors(nextErrors)
    if (!parsed.success || Object.keys(nextErrors).length) {
      const firstInvalid = Object.keys(nextErrors)[0]
      if (firstInvalid) document.getElementById(`${fieldPrefix}-${firstInvalid}`)?.focus()
      return
    }
    onSaved(await freshmanApi.updateCard(section, card.id, parsed.data))
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Edit ${card.title}`}
      description="Update this fixed position in the demo page."
      noun="card"
      dirty={dirty}
      submitLabel="Save demo changes"
      canSubmit={dirty}
      onSubmit={submit}
    >
      <FormField label="Title" htmlFor={`${fieldPrefix}-title`} error={errors.title}>
        <Input
          id={`${fieldPrefix}-title`}
          value={values.title}
          maxLength={120}
          aria-invalid={!!errors.title}
          aria-describedby={fieldHintId(`${fieldPrefix}-title`)}
          className={fieldControl}
          onChange={(event) => setValues({ ...values, title: event.target.value })}
        />
      </FormField>
      {section === "resources" && (
        <FormField label="Description" htmlFor={`${fieldPrefix}-description`} optional error={errors.description}>
          <Textarea
            id={`${fieldPrefix}-description`}
            value={values.description}
            maxLength={1000}
            aria-invalid={!!errors.description}
            aria-describedby={fieldHintId(`${fieldPrefix}-description`)}
            className={fieldControl}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
        </FormField>
      )}
      <FormField
        label="Destination"
        htmlFor={`${fieldPrefix}-href`}
        optional={section === "resources"}
        error={errors.href}
        hint="A site path such as /materials, or a full https:// URL. An empty resource has no link."
      >
        <Input
          id={`${fieldPrefix}-href`}
          value={values.href}
          maxLength={2048}
          aria-invalid={!!errors.href}
          aria-describedby={fieldHintId(`${fieldPrefix}-href`)}
          className={fieldControl}
          onChange={(event) => setValues({ ...values, href: event.target.value })}
        />
      </FormField>
      <FreshmanIconPicker value={values.icon} onValueChange={(icon) => setValues({ ...values, icon })} />
    </FormDialog>
  )
}
