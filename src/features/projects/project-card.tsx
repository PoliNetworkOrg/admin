import { useSortable } from "@dnd-kit/react/sortable"
import {
  ExternalLink,
  GripVertical,
  Languages,
  Link as LinkIcon,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { type ChangeEvent, useEffect, useId, useState } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PROJECT_CATEGORIES } from "./projects.constants"
import type { Project, ProjectCategory, ProjectFormValues } from "./types"

type ProjectCardProps = {
  project: Project
  draft: boolean
  initialEditActive: boolean
  sortableIndex: number
  onCancelDraft: () => void
  onDelete: () => Promise<boolean>
  onCategoryChange: (category: ProjectCategory) => Promise<void>
  onSave: (values: ProjectFormValues) => Promise<boolean>
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function ProjectCard({
  project,
  draft,
  initialEditActive,
  sortableIndex,
  onCancelDraft,
  onDelete,
  onCategoryChange,
  onSave,
}: ProjectCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: project.id,
    index: sortableIndex,
    group: project.category,
    disabled: draft,
  })
  const logoInputId = useId()
  const [editing, setEditing] = useState(initialEditActive)
  const [title, setTitle] = useState(project.title)
  const [descriptionIt, setDescriptionIt] = useState(project.descriptionIt)
  const [descriptionEn, setDescriptionEn] = useState(project.descriptionEn)
  const [link, setLink] = useState(project.link ?? "")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  function resetFields() {
    setTitle(project.title)
    setDescriptionIt(project.descriptionIt)
    setDescriptionEn(project.descriptionEn)
    setLink(project.link ?? "")
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
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function save() {
    if (saving || !title.trim() || !descriptionIt.trim() || !descriptionEn.trim()) return
    setSaving(true)
    try {
      const saved = await onSave({
        title: title.trim(),
        descriptionIt: descriptionIt.trim(),
        descriptionEn: descriptionEn.trim(),
        link: link.trim() || null,
        logo: project.logo,
        logoFile,
        category: project.category,
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

  const logo = logoPreview ?? project.logo

  return (
    <>
      <Card
        ref={(element) => ref(element)}
        className={cn("transition-opacity", isDragging && "relative z-10 opacity-60")}
      >
        <CardHeader className="grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1">
          <Button
            ref={(element) => handleRef(element)}
            type="button"
            size="icon-sm"
            variant="ghost"
            className="cursor-grab self-center text-muted-foreground active:cursor-grabbing"
            aria-label={`Reorder ${project.title}`}
            disabled={draft || editing}
          >
            <GripVertical />
          </Button>
          <CardTitle className="flex min-w-0 items-center gap-3 self-center text-lg">
            {editing ? (
              <>
                <label
                  htmlFor={logoInputId}
                  className="group relative grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-input bg-background transition-colors hover:bg-muted"
                >
                  <ProjectLogo logo={logo} title={title} />
                  <span className="absolute inset-0 grid place-items-center bg-background/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Upload className="size-4" />
                  </span>
                  <Input
                    id={logoInputId}
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg"
                    className="sr-only"
                    onChange={selectLogo}
                  />
                </label>
                <Input
                  aria-label="Project title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="min-w-0 text-base font-medium"
                  maxLength={160}
                  required
                />
              </>
            ) : (
              <>
                <ProjectLogo logo={logo} title={title} />
                <span className="truncate">{title}</span>
              </>
            )}
          </CardTitle>
          <CardAction className="flex items-center gap-1.5">
            {editing ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  onClick={() => void save()}
                  disabled={saving}
                  aria-label={`Save ${title}`}
                >
                  {saving ? <LoaderCircle className="animate-spin-slow" /> : <Save />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={cancelEdit}
                  disabled={saving}
                  aria-label="Cancel editing"
                >
                  <X />
                </Button>
              </>
            ) : (
              <>
                <ProjectCategoryMenu category={project.category} onCategoryChange={onCategoryChange} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setEditing(true)}
                  aria-label={`Edit ${title}`}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Delete ${title}`}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-2">
          <ProjectField label="Link" icon={<LinkIcon />} className="md:col-span-2">
            {editing ? (
              <Input
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                maxLength={2048}
                placeholder="https://…"
              />
            ) : project.link ? (
              <a
                href={project.link}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-10 items-center gap-2 break-all rounded-lg bg-muted/60 px-3 py-2 text-sm text-primary hover:underline"
              >
                {project.link} <ExternalLink className="size-3.5 shrink-0" />
              </a>
            ) : (
              <p className="min-h-10 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                No link provided
              </p>
            )}
          </ProjectField>
          <ProjectField label="Italian" icon={<Languages />}>
            {editing ? (
              <Textarea
                value={descriptionIt}
                onChange={(event) => setDescriptionIt(event.target.value)}
                className="min-h-28"
                maxLength={5000}
                required
              />
            ) : (
              <p className="min-h-28 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6">
                {project.descriptionIt}
              </p>
            )}
          </ProjectField>
          <ProjectField label="English" icon={<Languages />}>
            {editing ? (
              <Textarea
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
                className="min-h-28"
                maxLength={5000}
                required
              />
            ) : (
              <p className="min-h-28 whitespace-pre-wrap rounded-lg bg-muted/60 px-3 py-2 text-sm leading-6">
                {project.descriptionEn}
              </p>
            )}
          </ProjectField>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{project.title}</strong>? This action cannot be undone.
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

function ProjectLogo({ logo, title }: { logo: string | null; title: string }) {
  if (logo) return <img src={logo} alt="" className="size-11 shrink-0 rounded-lg object-contain" />
  return (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-sm font-semibold text-primary"
      aria-hidden="true"
    >
      {initials(title) || "PR"}
    </span>
  )
}

function ProjectField({
  label,
  icon,
  className,
  children,
}: {
  label: string
  icon: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Badge variant="secondary" className="w-fit gap-1.5">
        {icon} {label}
      </Badge>
      {children}
    </div>
  )
}

function ProjectCategoryMenu({
  category,
  onCategoryChange,
}: {
  category: ProjectCategory
  onCategoryChange: (category: ProjectCategory) => Promise<void>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="icon-sm" aria-label="Move project to another category" />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup
          value={category}
          onValueChange={(value) => void onCategoryChange(value as ProjectCategory)}
        >
          {PROJECT_CATEGORIES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
