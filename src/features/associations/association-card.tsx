import { CircleDashed, Languages, LinkIcon, LoaderCircle, Pencil, Save, Trash2, Upload, X } from "lucide-react"
import { type ChangeEvent, useEffect, useId, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import {
  ASSOCIATION_LINK_FIELDS,
  ASSOCIATION_LOGO_MAX_SIZE,
  ASSOCIATION_LOGO_TYPES,
  getAssociationInitials,
} from "./associations.constants"
import type { Association, AssociationFormValues } from "./types"

type AssociationCardProps = {
  association: Association
  draft: boolean
  initialEditActive: boolean
  onCancelDraft: () => void
  onDelete: () => Promise<boolean>
  onEditLinks: () => void
  onSave: (values: AssociationFormValues) => Promise<boolean>
}

export function AssociationCard({
  association,
  draft,
  initialEditActive,
  onCancelDraft,
  onDelete,
  onEditLinks,
  onSave,
}: AssociationCardProps) {
  const logoInputId = useId()
  const [editing, setEditing] = useState(initialEditActive)
  const [name, setName] = useState(association.name)
  const [descriptionIt, setDescriptionIt] = useState(association.descriptionIt)
  const [descriptionEn, setDescriptionEn] = useState(association.descriptionEn)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canSave = Boolean(name.trim() && descriptionIt.trim() && descriptionEn.trim())

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  function resetFields() {
    setName(association.name)
    setDescriptionIt(association.descriptionIt)
    setDescriptionEn(association.descriptionEn)
    setLogoFile(null)
    setLogoPreview(null)
  }

  function cancelEdit() {
    if (draft) {
      onCancelDraft()
      return
    }
    resetFields()
    setEditing(false)
  }

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!ASSOCIATION_LOGO_TYPES.some((type) => type === file.type)) {
      toast.error("Choose a JPG, PNG, or SVG logo.")
      event.target.value = ""
      return
    }
    if (file.size > ASSOCIATION_LOGO_MAX_SIZE) {
      toast.error("The logo must be no larger than 1 MB.")
      event.target.value = ""
      return
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function save() {
    if (saving || !canSave) return
    setSaving(true)
    try {
      const saved = await onSave({
        name: name.trim(),
        descriptionIt: descriptionIt.trim(),
        descriptionEn: descriptionEn.trim(),
        logo: association.logo,
        logoFile,
      })
      if (saved) {
        setLogoFile(null)
        setLogoPreview(null)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    try {
      if (await onDelete()) setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const logo = logoPreview ?? association.logo
  const linkCount = ASSOCIATION_LINK_FIELDS.filter(({ key }) => association.links[key]).length

  return (
    <>
      <Card
        className={cn("h-full", draft && "border-dashed border-primary/60 bg-primary/[0.035] ring-1 ring-primary/10")}
      >
        <CardHeader
          className={cn(
            "grid-cols-[1fr_auto] gap-x-4",
            editing && "border-b pb-(--card-spacing)",
            draft && "border-primary/15"
          )}
        >
          <CardTitle className={cn("flex min-w-0 gap-3 text-lg", editing ? "items-start" : "items-center")}>
            {editing ? (
              <>
                <label
                  htmlFor={logoInputId}
                  className="group/logo relative grid size-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-input bg-background text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
                >
                  {logo ? (
                    <img src={logo} alt="" className="size-full object-contain p-1" />
                  ) : (
                    getAssociationInitials(name) || "AS"
                  )}
                  <span className="absolute inset-0 grid place-items-center bg-background/85 opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-within/logo:opacity-100">
                    <Upload className="size-4" />
                  </span>
                  <Input
                    id={logoInputId}
                    type="file"
                    aria-label="Association logo"
                    accept="image/jpeg,image/png,image/svg+xml"
                    className="sr-only"
                    onChange={selectLogo}
                  />
                </label>
                <div className="min-w-0 flex-1 space-y-2">
                  {draft && (
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      <CircleDashed data-icon="inline-start" /> Unsaved draft
                    </Badge>
                  )}
                  <Input
                    aria-label="Association name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="bg-background text-base font-medium"
                    maxLength={200}
                    required
                    autoFocus={draft}
                  />
                </div>
              </>
            ) : (
              <>
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted text-sm font-semibold text-muted-foreground">
                  {association.logo ? (
                    <img src={association.logo} alt="" className="size-full object-contain p-1" />
                  ) : (
                    getAssociationInitials(association.name)
                  )}
                </span>
                <span className="truncate">{association.name}</span>
              </>
            )}
          </CardTitle>
          <CardAction className="flex items-center gap-1.5">
            {editing ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  disabled={saving || !canSave}
                  onClick={() => void save()}
                  aria-label={`Save ${name}`}
                >
                  {saving ? <LoaderCircle className="animate-spin-slow" /> : <Save />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={saving}
                  onClick={cancelEdit}
                  aria-label="Cancel editing"
                >
                  <X />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={`Edit ${association.name}`}
                  onClick={() => {
                    resetFields()
                    setEditing(true)
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  aria-label={`Delete ${association.name}`}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {editing ? (
              <>
                <EditableDescription
                  language="IT"
                  ariaLabel="Italian association description"
                  value={descriptionIt}
                  onChange={setDescriptionIt}
                  draft={draft}
                />
                <EditableDescription
                  language="EN"
                  ariaLabel="English association description"
                  value={descriptionEn}
                  onChange={setDescriptionEn}
                  draft={draft}
                />
              </>
            ) : (
              <>
                <Description language="IT" text={association.descriptionIt} />
                <Description language="EN" text={association.descriptionEn} />
              </>
            )}
          </div>
          {!draft && (
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
              <Badge variant="secondary">
                {linkCount} {linkCount === 1 ? "public link" : "public links"}
              </Badge>
              <Button type="button" variant="outline" size="sm" disabled={editing} onClick={onEditLinks}>
                <LinkIcon data-icon="inline-start" /> Manage links
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete association</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{association.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void remove()}>
              {deleting && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EditableDescription({
  language,
  ariaLabel,
  value,
  onChange,
  draft,
}: {
  language: string
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  draft: boolean
}) {
  return (
    <section
      className={cn("min-w-0 rounded-lg border bg-background/75 p-3.5", draft ? "border-primary/15" : "border-border")}
    >
      <div
        className={cn(
          "mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase",
          draft ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Languages className="size-3.5" /> {language}
      </div>
      <Textarea
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-32 bg-background"
        maxLength={20_000}
        required
      />
    </section>
  )
}

function Description({ language, text }: { language: string; text: string }) {
  return (
    <section className="min-w-0 rounded-lg bg-muted/45 p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        <Languages className="size-3.5" /> {language}
      </div>
      <p className="line-clamp-5 text-sm leading-6 text-foreground/85">{text}</p>
    </section>
  )
}
