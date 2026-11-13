import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"

import {
  DateField,
  fieldControl,
  fieldHintId,
  FileButton,
  FormDialog,
  FormField,
  SelectField,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { dateOnlyValue, parseDateOnly } from "@/lib/date-only"
import { errorHasCode } from "@/lib/errors"
import { cn } from "@/lib/utils"

import {
  addDocumentVersion,
  createDocument,
  createDocumentCategory,
  updateDocument,
  updateDocumentCategory,
} from "./documents.functions"
import {
  DOCUMENT_DESCRIPTION_MAX_LENGTH,
  DOCUMENT_SLUG_MAX_LENGTH,
  DOCUMENT_TITLE_MAX_LENGTH,
  DOCUMENT_VERSION_MAX_LENGTH,
  documentCategoryInput,
  documentInput,
  documentsErrorMessage,
  fieldErrors,
  isValidDocumentFile,
  slugFromTitle,
} from "./documents.validation"
import type { DocumentCategory, DocumentVersion, WebDocument } from "./types"

const TEXT_FIELDS = ["title", "slug", "description"] as const
type TextErrors = Partial<Record<(typeof TEXT_FIELDS)[number], string>>
type TextValues = { title: string; slug: string; description: string }

/**
 * Title, slug and description, shared by both dialogs. A new record's slug follows its title until it is edited by
 * hand; an existing record's slug never changes on its own.
 */
function useTextFields(initial: TextValues, followTitle: boolean) {
  const [values, setValues] = useState(initial)
  const [slugEdited, setSlugEdited] = useState(!followTitle)
  const [errors, setErrors] = useState<TextErrors>({})
  const dirty =
    values.title !== initial.title || values.slug !== initial.slug || values.description !== initial.description

  function setTitle(title: string) {
    setValues((current) => ({ ...current, title, slug: slugEdited ? current.slug : slugFromTitle(title) }))
  }

  function setSlug(slug: string) {
    setSlugEdited(true)
    setValues((current) => ({ ...current, slug }))
  }

  return { values, setValues, setTitle, setSlug, errors, setErrors, dirty }
}

type TextFieldsProps = {
  prefix: string
  fields: ReturnType<typeof useTextFields>
  slugHint: string
  descriptionOptional: boolean
  descriptionPlaceholder: string
}

function TextFields({ prefix, fields, slugHint, descriptionOptional, descriptionPlaceholder }: TextFieldsProps) {
  const { values, errors } = fields
  const id = (field: string) => `${prefix}-${field}`
  return (
    <>
      <FormField
        label="Title"
        htmlFor={id("title")}
        error={errors.title}
        counter={{ length: values.title.length, max: DOCUMENT_TITLE_MAX_LENGTH }}
      >
        <Input
          id={id("title")}
          value={values.title}
          maxLength={DOCUMENT_TITLE_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? fieldHintId(id("title")) : undefined}
          className={cn("h-9 px-3", fieldControl)}
          onChange={(event) => fields.setTitle(event.target.value)}
        />
      </FormField>
      <FormField label="Slug" htmlFor={id("slug")} error={errors.slug} hint={slugHint}>
        <Input
          id={id("slug")}
          value={values.slug}
          maxLength={DOCUMENT_SLUG_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.slug ? true : undefined}
          aria-describedby={fieldHintId(id("slug"))}
          className={cn("h-9 px-3 font-mono", fieldControl)}
          onChange={(event) => fields.setSlug(event.target.value)}
        />
      </FormField>
      <FormField
        label="Description"
        htmlFor={id("description")}
        optional={descriptionOptional}
        error={errors.description}
        counter={{ length: values.description.length, max: DOCUMENT_DESCRIPTION_MAX_LENGTH }}
      >
        <Textarea
          id={id("description")}
          value={values.description}
          maxLength={DOCUMENT_DESCRIPTION_MAX_LENGTH}
          placeholder={descriptionPlaceholder}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? fieldHintId(id("description")) : undefined}
          className={fieldControl}
          onChange={(event) => fields.setValues((current) => ({ ...current, description: event.target.value }))}
        />
      </FormField>
    </>
  )
}

function focusFirstError(prefix: string, errors: TextErrors & { category?: string }) {
  const first = (["category", ...TEXT_FIELDS] as const).find((field) => errors[field])
  if (first) document.getElementById(`${prefix}-${first}`)?.focus()
}

type CategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this category; `null` creates one. Mount with a fresh `key` per opening. */
  category: DocumentCategory | null
  /** Reloads the route; runs before the dialog closes, with the saved category's id. */
  onSaved: (categoryId: number) => Promise<void>
}

/** "Add category" / "Edit category": title, slug and description. */
export function DocumentCategoryDialog({ open, onOpenChange, category, onSaved }: CategoryDialogProps) {
  const createFn = useServerFn(createDocumentCategory)
  const updateFn = useServerFn(updateDocumentCategory)
  const prefix = useId()
  const fields = useTextFields(
    { title: category?.title ?? "", slug: category?.slug ?? "", description: category?.description ?? "" },
    category === null
  )

  async function submit() {
    const parsed = documentCategoryInput.safeParse(fields.values)
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error, TEXT_FIELDS)
      fields.setErrors(errors)
      focusFirstError(prefix, errors)
      return
    }
    fields.setErrors({})
    let categoryId: number
    try {
      categoryId = category
        ? (await updateFn({ data: { id: category.id, ...parsed.data } })).id
        : (await createFn({ data: parsed.data })).id
    } catch (error) {
      console.error(error)
      if (errorHasCode(error, "DUPLICATE_SLUG")) {
        fields.setErrors({ slug: documentsErrorMessage(error, "category", "") })
        focusFirstError(prefix, { slug: "duplicate" })
        return
      }
      throw new Error(
        documentsErrorMessage(
          error,
          "category",
          category ? "Couldn't save the category." : "Couldn't add the category."
        )
      )
    }
    await onSaved(categoryId)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Edit category" : "Add category"}
      description="Categories group the documents on the website's documents page, in this order."
      noun="category"
      dirty={fields.dirty}
      submitLabel={category ? "Save changes" : "Create category"}
      canSubmit={category === null || fields.dirty}
      onSubmit={submit}
    >
      <TextFields
        prefix={prefix}
        fields={fields}
        slugHint="Lowercase letters, numbers and hyphens. It identifies the category on the website."
        descriptionOptional
        descriptionPlaceholder="Shown under the category title on the website"
      />
    </FormDialog>
  )
}

type DocumentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this document; `null` creates one in `categoryId`. Mount with a fresh `key` per opening. */
  document: WebDocument | null
  categoryId: number
  categories: DocumentCategory[]
  /** Reloads the route; runs before the dialog closes, with the saved document's id and category. */
  onSaved: (saved: { id: number; categoryId: number }) => Promise<void>
  /** Where focus goes on close, e.g. when moving the document unmounted the button that opened the dialog. */
  finalFocus?: () => HTMLElement | null
}

/** "Add document" / "Edit document": category, title, slug and description. Versions are uploaded separately. */
export function DocumentDialog({
  open,
  onOpenChange,
  document,
  categoryId,
  categories,
  onSaved,
  finalFocus,
}: DocumentDialogProps) {
  const createFn = useServerFn(createDocument)
  const updateFn = useServerFn(updateDocument)
  const prefix = useId()
  const fields = useTextFields(
    { title: document?.title ?? "", slug: document?.slug ?? "", description: document?.description ?? "" },
    document === null
  )
  const [category, setCategory] = useState(String(categoryId))
  const [categoryError, setCategoryError] = useState<string | undefined>(undefined)
  const dirty = fields.dirty || category !== String(categoryId)
  const slugChanged = document !== null && fields.values.slug.trim() !== document.slug

  async function submit() {
    const parsed = documentInput.safeParse({ ...fields.values, categoryId: Number(category) })
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error, TEXT_FIELDS)
      const missingCategory = parsed.error.issues.some((issue) => issue.path[0] === "categoryId")
      fields.setErrors(errors)
      setCategoryError(missingCategory ? "Choose a category." : undefined)
      focusFirstError(prefix, { ...errors, category: missingCategory ? "missing" : undefined })
      return
    }
    fields.setErrors({})
    setCategoryError(undefined)
    let saved: { id: number; categoryId: number }
    try {
      saved = document
        ? await updateFn({ data: { id: document.id, ...parsed.data } })
        : await createFn({ data: parsed.data })
    } catch (error) {
      console.error(error)
      if (errorHasCode(error, "DUPLICATE_SLUG")) {
        fields.setErrors({ slug: documentsErrorMessage(error, "document", "") })
        focusFirstError(prefix, { slug: "duplicate" })
        return
      }
      if (errorHasCode(error, "CATEGORY_NOT_FOUND")) {
        setCategoryError(documentsErrorMessage(error, "document", ""))
        return
      }
      throw new Error(
        documentsErrorMessage(
          error,
          "document",
          document ? "Couldn't save the document." : "Couldn't add the document."
        )
      )
    }
    await onSaved({ id: saved.id, categoryId: saved.categoryId })
    onOpenChange(false)
  }

  const publicPath = `/documents/view/${fields.values.slug.trim() || "…"}`

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={finalFocus}
      title={document ? "Edit document" : "Add document"}
      description={
        document
          ? undefined
          : "The document appears on the website once it has a version: upload one after creating it."
      }
      noun="document"
      dirty={dirty}
      submitLabel={document ? "Save changes" : "Create document"}
      canSubmit={document === null || dirty}
      onSubmit={submit}
    >
      <FormField
        label="Category"
        htmlFor={`${prefix}-category`}
        error={categoryError}
        hint={document && category !== String(categoryId) ? "It moves to the end of the chosen category." : undefined}
      >
        <SelectField
          id={`${prefix}-category`}
          value={category}
          options={categories.map((item) => ({ value: String(item.id), label: item.title }))}
          onChange={(next) => {
            setCategory(next)
            setCategoryError(undefined)
          }}
          placeholder="Choose a category"
          invalid={Boolean(categoryError)}
          describedBy={fieldHintId(`${prefix}-category`)}
        />
      </FormField>
      <TextFields
        prefix={prefix}
        fields={fields}
        slugHint={
          slugChanged
            ? `The public link becomes ${publicPath}: links to /documents/view/${document.slug} that were already shared stop working.`
            : `Lowercase letters, numbers and hyphens. Public link: ${publicPath}${document ? ". Changing it breaks links already shared." : ""}`
        }
        descriptionOptional
        descriptionPlaceholder="Shown with the document on the website"
      />
    </FormDialog>
  )
}

type VersionErrors = { version?: string; date?: string; file?: string }

function validateVersion(version: string, date: string, file: File | null, existing: string[]): VersionErrors {
  const errors: VersionErrors = {}
  const trimmed = version.trim()
  if (trimmed === "") errors.version = "Enter a version."
  else if (trimmed.length > DOCUMENT_VERSION_MAX_LENGTH) errors.version = "Keep the version within 50 characters."
  else if (existing.includes(trimmed)) errors.version = DUPLICATE_VERSION
  if (!parseDateOnly(date)) errors.date = "Choose a date."
  if (!file) errors.file = "Choose a PDF file."
  else if (!isValidDocumentFile(file)) errors.file = "Choose a PDF file no larger than 10 MB."
  return errors
}

const DUPLICATE_VERSION = "This document already has a version with this name."

type VersionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: WebDocument
  /** Reloads the route and reports success before the dialog closes. */
  onUploaded: (version: DocumentVersion) => Promise<void>
}

/** "Upload version": a dated PDF that becomes the current version when it is the newest. */
export function DocumentVersionDialog({ open, onOpenChange, document, onUploaded }: VersionDialogProps) {
  const addVersionFn = useServerFn(addDocumentVersion)
  const [initialDate] = useState(() => dateOnlyValue(new Date()))
  const [version, setVersion] = useState("")
  const [date, setDate] = useState(initialDate)
  const [file, setFile] = useState<File | null>(null)
  const [shown, setShown] = useState<VersionErrors>({})
  const versionId = useId()
  const dateId = useId()
  const fileId = useId()
  const existing = document.versions.map((item) => item.version)

  const dirty = version !== "" || file !== null || date !== initialDate

  /** After a field has errored, its message tracks the value. */
  function revalidate(field: keyof VersionErrors, next: { version?: string; date?: string; file?: File | null }) {
    if (!shown[field]) return
    const nextFile = "file" in next ? (next.file ?? null) : file
    const errors = validateVersion(next.version ?? version, next.date ?? date, nextFile, existing)
    setShown((current) => ({ ...current, [field]: errors[field] }))
  }

  async function submit() {
    const errors = validateVersion(version, date, file, existing)
    setShown(errors)
    if (errors.version || errors.date || errors.file || !file) {
      const first = errors.version ? versionId : errors.date ? dateId : fileId
      const field = window.document.getElementById(first)
      // The file input is hidden: focus the button that opens it
      const target = field instanceof HTMLInputElement && field.type === "file" ? field.nextElementSibling : field
      if (target instanceof HTMLElement) target.focus()
      return
    }
    const formData = new FormData()
    formData.set("documentId", String(document.id))
    formData.set("version", version.trim())
    formData.set("date", date)
    formData.set("file", file)
    let uploaded: DocumentVersion
    try {
      uploaded = await addVersionFn({ data: formData })
    } catch (error) {
      console.error(error)
      if (errorHasCode(error, "DUPLICATE_VERSION")) {
        setShown((current) => ({ ...current, version: DUPLICATE_VERSION }))
        return
      }
      throw new Error(
        documentsErrorMessage(error, "version", "Couldn't upload the version. Check the file and try again.")
      )
    }
    await onUploaded(uploaded)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload version"
      description={`A dated PDF of ${document.title}. The website links the version with the latest date.`}
      noun="version"
      dirty={dirty}
      submitLabel="Upload version"
      onSubmit={submit}
    >
      <FormField label="Version" htmlFor={versionId} error={shown.version}>
        <Input
          id={versionId}
          value={version}
          maxLength={DOCUMENT_VERSION_MAX_LENGTH}
          autoComplete="off"
          placeholder="e.g. 2026 or 1.1"
          aria-invalid={shown.version ? true : undefined}
          aria-describedby={shown.version ? fieldHintId(versionId) : undefined}
          onChange={(event) => {
            setVersion(event.target.value)
            revalidate("version", { version: event.target.value })
          }}
          onBlur={() => {
            const error = validateVersion(version, date, file, existing).version
            if (shown.version || error === DUPLICATE_VERSION) setShown((current) => ({ ...current, version: error }))
          }}
          className={cn("h-9 px-3 font-mono", fieldControl)}
        />
      </FormField>
      <FormField label="Date" htmlFor={dateId} error={shown.date}>
        <DateField
          id={dateId}
          value={date}
          pastYears={30}
          invalid={Boolean(shown.date)}
          describedBy={shown.date ? fieldHintId(dateId) : undefined}
          onChange={(value) => {
            setDate(value)
            revalidate("date", { date: value })
          }}
        />
      </FormField>
      <FormField label="PDF file" htmlFor={fileId} hint="PDF only, up to 10 MB." error={shown.file}>
        <FileButton
          id={fileId}
          file={file}
          accept="application/pdf"
          label="Choose PDF"
          invalid={Boolean(shown.file)}
          describedBy={fieldHintId(fileId)}
          onChange={(next) => {
            setFile(next)
            revalidate("file", { file: next })
          }}
        />
      </FormField>
    </FormDialog>
  )
}
