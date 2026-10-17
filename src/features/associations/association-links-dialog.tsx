import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { z } from "zod"

import { fieldControl, fieldHintId, FormDialog, FormField } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { errorHasCode } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { ASSOCIATION_LINK_FIELDS, ASSOCIATION_LINK_MAX_LENGTH, EMPTY_ASSOCIATION_LINKS } from "./associations.constants"
import { editAssociationLinks } from "./associations.functions"
import type { Association, AssociationLink, AssociationLinks } from "./types"

type Values = Record<AssociationLink, string>
type Errors = Partial<Record<AssociationLink, string>>

// The server's rule (`associationLinksInput`), so a value that passes here is never rejected there.
const emailSchema = z.email()

function valuesOf(links: AssociationLinks) {
  return {
    email: links.email ?? "",
    website: links.website ?? "",
    facebook: links.facebook ?? "",
    instagram: links.instagram ?? "",
    tiktok: links.tiktok ?? "",
    x: links.x ?? "",
    youtube: links.youtube ?? "",
    telegram: links.telegram ?? "",
    linkedin: links.linkedin ?? "",
    spotify: links.spotify ?? "",
  } satisfies Values
}

function errorFor(key: AssociationLink, raw: string) {
  const value = raw.trim()
  if (value === "") return undefined
  if (key === "email") return emailSchema.safeParse(value).success ? undefined : "Enter a valid email address."
  if (URL.canParse(value)) {
    const { protocol } = new URL(value)
    if (protocol === "http:" || protocol === "https:") return undefined
  }
  return "Enter a full URL starting with https://."
}

function validate(values: Values) {
  const errors: Errors = {}
  for (const { key } of ASSOCIATION_LINK_FIELDS) {
    const error = errorFor(key, values[key])
    if (error) errors[key] = error
  }
  return errors
}

function fieldId(associationId: number, key: AssociationLink) {
  return `association-${associationId}-${key}`
}

type AssociationLinksDialogProps = {
  /** Kept while the dialog animates closed. */
  association: Association | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs after the links are saved, before the dialog closes. */
  onSaved: () => Promise<void>
}

/** Two-column form of the ten public links. Remount it (via `key`) each time it opens. */
export function AssociationLinksDialog({ association, open, onOpenChange, onSaved }: AssociationLinksDialogProps) {
  const editLinksFn = useServerFn(editAssociationLinks)
  const [initial] = useState(() => valuesOf(association?.links ?? EMPTY_ASSOCIATION_LINKS))
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const dirty = ASSOCIATION_LINK_FIELDS.some(({ key }) => values[key].trim() !== initial[key].trim())

  if (!association) return null
  const { id, name } = association

  function revalidate(key: AssociationLink) {
    if (!errors[key]) return
    setErrors((current) => ({ ...current, [key]: errorFor(key, values[key]) }))
  }

  async function submit() {
    const nextErrors = validate(values)
    setErrors(nextErrors)
    const firstInvalid = ASSOCIATION_LINK_FIELDS.find(({ key }) => nextErrors[key])
    if (firstInvalid) {
      document.getElementById(fieldId(id, firstInvalid.key))?.focus()
      return
    }
    const links: AssociationLinks = { ...EMPTY_ASSOCIATION_LINKS }
    for (const { key } of ASSOCIATION_LINK_FIELDS) links[key] = values[key].trim() || null
    try {
      await editLinksFn({ data: { id, links } })
    } catch (error) {
      console.error(error)
      throw new Error(
        errorHasCode(error, "NOT_FOUND")
          ? "This association no longer exists."
          : "The links could not be saved. Check the values and your permissions.",
        { cause: error }
      )
    }
    await onSaved()
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`${name} links`}
      description="Manage the public contact and social profiles for this association."
      noun="association"
      dirty={dirty}
      submitLabel="Save links"
      onSubmit={submit}
    >
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {ASSOCIATION_LINK_FIELDS.map(({ key, label, placeholder }) => {
          const inputId = fieldId(id, key)
          const error = errors[key]
          return (
            <FormField key={key} label={label} htmlFor={inputId} error={error}>
              <Input
                id={inputId}
                type={key === "email" ? "email" : "url"}
                inputMode={key === "email" ? "email" : "url"}
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                maxLength={ASSOCIATION_LINK_MAX_LENGTH}
                value={values[key]}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? fieldHintId(inputId) : undefined}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                onBlur={() => revalidate(key)}
                className={cn("h-9", fieldControl)}
              />
            </FormField>
          )
        })}
      </div>
    </FormDialog>
  )
}
