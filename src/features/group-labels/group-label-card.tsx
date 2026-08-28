import { CircleDashed, LoaderCircle, Pencil, Save, Trash2, X } from "lucide-react"
import { useState } from "react"

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

import { GroupLabelColorPicker } from "./group-label-color-picker"
import { GROUP_LABEL_DESCRIPTION_MAX, GROUP_LABEL_MAX, getGroupLabelColor } from "./group-labels.constants"
import type { GroupLabel, GroupLabelFormValues } from "./types"

type GroupLabelCardProps = {
  groupLabel: GroupLabel
  draft: boolean
  initialEditActive: boolean
  onCancelDraft: () => void
  onDelete: () => Promise<boolean>
  onSave: (values: GroupLabelFormValues) => Promise<boolean>
}

export function GroupLabelCard({
  groupLabel,
  draft,
  initialEditActive,
  onCancelDraft,
  onDelete,
  onSave,
}: GroupLabelCardProps) {
  const [label, setLabel] = useState(groupLabel.label)
  const [editing, setEditing] = useState(initialEditActive)
  const [color, setColor] = useState(groupLabel.color)
  const [description, setDescription] = useState(groupLabel.description)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canSave = Boolean(label.trim())

  function resetFields() {
    setLabel(groupLabel.label)
    setColor(groupLabel.color)
    setDescription(groupLabel.description)
  }

  function cancelEdit() {
    if (draft) {
      onCancelDraft()
      return
    }
    resetFields()
    setEditing(false)
  }

  async function save() {
    if (saving || !canSave) return
    setSaving(true)
    try {
      const saved = await onSave({ label: label.trim(), color, description: description.trim() })
      if (saved) setEditing(false)
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

  const swatch = getGroupLabelColor(groupLabel.color)

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
          <CardTitle className="flex min-w-0 items-start gap-3 text-lg">
            {editing ? (
              <div className="min-w-0 flex-1 space-y-2">
                {draft && (
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    <CircleDashed data-icon="inline-start" /> Unsaved draft
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  <GroupLabelColorPicker value={color} onChange={setColor} />
                  <Input
                    aria-label="Label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    className="bg-background text-base font-medium"
                    maxLength={GROUP_LABEL_MAX}
                    required
                    autoFocus={draft}
                  />
                </div>
              </div>
            ) : (
              <Badge className={cn("h-auto py-1 text-sm", swatch.badge)}>{groupLabel.label}</Badge>
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
                  aria-label={`Save ${label}`}
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
                  aria-label={`Edit ${groupLabel.label}`}
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
                  aria-label={`Delete ${groupLabel.label}`}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {editing ? (
            <Textarea
              aria-label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 bg-background"
              maxLength={GROUP_LABEL_DESCRIPTION_MAX}
              placeholder="What kind of groups does this label apply to?"
            />
          ) : (
            <p className="text-sm leading-6 text-foreground/85">
              {groupLabel.description || <span className="text-muted-foreground italic">No description</span>}
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{groupLabel.label}</strong>? This action cannot be undone.
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
