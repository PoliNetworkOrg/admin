import { FolderPlus, LoaderCircle, MoreVertical, Pencil, PencilLine, Save, Trash2, X } from "lucide-react"
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
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { AddChildLabelDialog } from "@/features/groups-by-label/add-child-label-dialog"
import { cn } from "@/lib/utils"

import { GroupLabelColorPicker } from "./group-label-color-picker"
import { GROUP_LABEL_DESCRIPTION_MAX, getGroupLabelColor } from "./group-labels.constants"
import { formatLabelBreadcrumb, formatLabelSegment } from "./label-tree"
import { RenameLabelDialog } from "./rename-label-dialog"
import type { GroupLabel, GroupLabelEditValues } from "./types"

type GroupLabelCardProps = {
  groupLabel: GroupLabel
  /** The full label list, used to find this label's descendants when renaming (they get re-pathed too). */
  allLabels: GroupLabel[]
  /** Rendered before everything else in the row — the tree's expand/collapse chevron, when this node has children. */
  leading?: React.ReactNode
  /** Off for the two fixed category roots — the whole category tree depends on their exact name. */
  allowRename?: boolean
  /** Off for flat tags, which never nest. */
  allowChildren?: boolean
  onDelete: () => Promise<boolean>
  onSave: (values: GroupLabelEditValues) => Promise<boolean>
}

export function GroupLabelCard({
  groupLabel,
  allLabels,
  leading,
  allowRename = true,
  allowChildren = true,
  onDelete,
  onSave,
}: GroupLabelCardProps) {
  const [color, setColor] = useState(groupLabel.color)
  const [description, setDescription] = useState(groupLabel.description ?? "")
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)

  const segments = groupLabel.label.split(".")
  const segment = segments[segments.length - 1] || groupLabel.label
  const displaySegment = formatLabelSegment(segment)

  function resetFields() {
    setColor(groupLabel.color)
    setDescription(groupLabel.description ?? "")
  }

  function cancelEdit() {
    resetFields()
    setEditing(false)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      const saved = await onSave({ color, description: description.trim() })
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

  const swatch = getGroupLabelColor(editing ? color : groupLabel.color)
  const affectedLabels = allLabels.filter(
    (label) => label.label === groupLabel.label || label.label.startsWith(`${groupLabel.label}.`)
  )

  return (
    <>
      <Card className="flex-row items-center gap-4 px-(--card-spacing) py-3">
        {leading}

        {editing ? (
          <>
            <div className="flex shrink-0 items-center gap-2">
              <GroupLabelColorPicker value={color} onChange={setColor} />
              <Badge
                className={cn("h-auto max-w-64 min-w-0 shrink py-1 text-sm", swatch.badgeClassName)}
                style={swatch.badgeStyle}
                title={groupLabel.label}
              >
                <span className="truncate">{displaySegment}</span>
              </Badge>
            </div>
            <Input
              aria-label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-w-0 flex-1 bg-background"
              maxLength={GROUP_LABEL_DESCRIPTION_MAX}
              placeholder="What kind of groups does this label apply to?"
            />
          </>
        ) : (
          <>
            <Badge
              className={cn("h-auto max-w-[min(50%,24rem)] min-w-0 shrink py-1 text-sm", swatch.badgeClassName)}
              style={swatch.badgeStyle}
              title={groupLabel.label}
            >
              <span className="truncate">{displaySegment}</span>
            </Badge>
            <p className="min-w-0 flex-1 truncate text-sm text-foreground/85">
              {groupLabel.description || <span className="text-muted-foreground italic">No description</span>}
            </p>
          </>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <Button
                type="button"
                size="icon-sm"
                disabled={saving}
                onClick={() => void save()}
                aria-label={`Save ${displaySegment}`}
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
              {(allowRename || allowChildren) && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-sm" />}>
                    <MoreVertical />
                    <span className="sr-only">More actions for {displaySegment}</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      {allowRename && (
                        <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                          <PencilLine /> Rename
                        </DropdownMenuItem>
                      )}
                      {allowChildren && (
                        <DropdownMenuItem onClick={() => setAddChildOpen(true)}>
                          <FolderPlus /> Add sub-category
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`Edit color and description for ${displaySegment}`}
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
                aria-label={`Delete ${displaySegment}`}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </Card>

      {allowRename && (
        <RenameLabelDialog
          path={groupLabel.label}
          segment={segment}
          affectedLabels={affectedLabels}
          open={renameOpen}
          onOpenChange={setRenameOpen}
        />
      )}
      {allowChildren && (
        <AddChildLabelDialog
          path={groupLabel.label}
          open={addChildOpen}
          onOpenChange={setAddChildOpen}
          navigateOnSuccess={false}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete label</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{formatLabelBreadcrumb(groupLabel.label)}</strong>? This action
              cannot be undone.
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
