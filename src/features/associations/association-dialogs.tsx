import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, OctagonX, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ASSOCIATION_LOGO_MAX_SIZE, ASSOCIATION_LOGO_TYPES, getAssociationInitials } from "./associations.constants"
import { createAssociation, deleteAssociation, editAssociation } from "./associations.functions"
import { associationSaveErrorMessage } from "./associations.validation"
import type { Association } from "./types"

export type AssociationDialogState = { mode: "create" } | { mode: "edit"; association: Association }

export function AssociationDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: AssociationDialogState
  onClose: () => void
  onSaved: (association: Association, mode: AssociationDialogState["mode"]) => void
}) {
  const editing = dialog.mode === "edit"
  const association = editing ? dialog.association : null
  const [name, setName] = useState(association?.name ?? "")
  const [descriptionIt, setDescriptionIt] = useState(association?.descriptionIt ?? "")
  const [descriptionEn, setDescriptionEn] = useState(association?.descriptionEn ?? "")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const logoInput = useRef<HTMLInputElement>(null)
  const createAssociationFn = useServerFn(createAssociation)
  const editAssociationFn = useServerFn(editAssociation)

  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    },
    [logoPreview]
  )

  function selectLogo(file: File | null) {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    if (
      logoFile &&
      (!ASSOCIATION_LOGO_TYPES.some((type) => type === logoFile.type) || logoFile.size > ASSOCIATION_LOGO_MAX_SIZE)
    ) {
      setError("Choose a JPG, PNG, or SVG logo no larger than 1 MB.")
      return
    }

    setPending(true)
    setError("")
    try {
      const data = new FormData()
      data.set("name", name)
      data.set("descriptionIt", descriptionIt)
      data.set("descriptionEn", descriptionEn)
      if (logoFile) data.set("logo", logoFile)
      else if (association?.logo) data.set("logo", association.logo)

      if (editing) data.set("id", String(dialog.association.id))
      const saved = editing ? await editAssociationFn({ data }) : await createAssociationFn({ data })
      onSaved(saved, dialog.mode)
    } catch (cause) {
      setError(associationSaveErrorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  const logoSource = logoPreview ?? association?.logo

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">
            WEB · ASSOCIATIONS
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
            {editing ? "Edit association" : "Add an association"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the public identity and bilingual descriptions."
              : "Create an association entry for the public website."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <div className="flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted text-lg font-semibold text-muted-foreground">
                {logoSource ? (
                  <img src={logoSource} alt="" className="size-full object-contain p-1" />
                ) : (
                  getAssociationInitials(name) || "?"
                )}
              </span>
              <Field>
                <FieldLabel htmlFor="association-logo">Logo</FieldLabel>
                <Input
                  ref={logoInput}
                  id="association-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/svg+xml"
                  className="sr-only"
                  onChange={(event) => selectLogo(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" onClick={() => logoInput.current?.click()}>
                  <Upload data-icon="inline-start" /> {logoFile ? "Change selected logo" : "Choose logo"}
                </Button>
                <FieldDescription>Optional JPG, PNG, or SVG, up to 1 MB.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="association-name">Name</FieldLabel>
              <Input
                id="association-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
                autoFocus
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="association-description-it">Italian description</FieldLabel>
                <Textarea
                  id="association-description-it"
                  value={descriptionIt}
                  onChange={(event) => setDescriptionIt(event.target.value)}
                  className="min-h-40"
                  maxLength={20_000}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="association-description-en">English description</FieldLabel>
                <Textarea
                  id="association-description-en"
                  value={descriptionEn}
                  onChange={(event) => setDescriptionEn(event.target.value)}
                  className="min-h-40"
                  maxLength={20_000}
                  required
                />
              </Field>
            </div>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim() || !descriptionIt.trim() || !descriptionEn.trim()}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {editing ? "Save changes" : "Create association"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteAssociationDialog({
  association,
  onClose,
  onDeleted,
}: {
  association: Association
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const [pending, setPending] = useState(false)
  const deleteAssociationFn = useServerFn(deleteAssociation)

  async function remove() {
    setPending(true)
    try {
      await deleteAssociationFn({ data: { id: association.id } })
      onDeleted(association.id)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      if (message.includes("NOT_FOUND")) onDeleted(association.id)
      else toast.error("The association could not be deleted. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
            <OctagonX />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete association</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{association.name}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
