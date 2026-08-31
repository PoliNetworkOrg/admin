import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { GROUP_LABEL_MAX } from "./group-labels.constants"
import { renameGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import { formatLabelBreadcrumb, isReservedCategoryRoot, labelPathToUrlSegments } from "./label-tree"
import type { GroupLabel } from "./types"

export function RenameLabelDialog({
  path,
  segment,
  affectedLabels,
  open,
  onOpenChange,
}: {
  /** The full dotted path being renamed, e.g. "informatica.magistrale" — may be a pure grouping node with no label of its own. */
  path: string
  /** The last segment of `path`, e.g. "magistrale". */
  segment: string
  /** Every real label at `path` or nested under it (self, if any, plus all descendants) — all get re-pathed. */
  affectedLabels: GroupLabel[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const renameGroupLabelFn = useServerFn(renameGroupLabel)
  const [newSegment, setNewSegment] = useState(segment)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const inputId = useId()

  useEffect(() => {
    if (open) {
      setNewSegment(segment)
      setError("")
    }
  }, [open, segment])

  const trimmed = newSegment.trim()
  // No "." before the segment when it's a top-level node (path === segment).
  const parentPrefix = path.length > segment.length ? path.slice(0, path.length - segment.length - 1) : ""
  // Only a bare top-level rename (a tag, since the two category roots never reach this dialog) could collide
  // with a reserved root name — a nested rename can't, since it'd still be dotted.
  const reserved = !parentPrefix && isReservedCategoryRoot(trimmed)
  const canSave = trimmed.length > 0 && !trimmed.includes(".") && trimmed !== segment && !reserved
  const newPath = parentPrefix ? `${parentPrefix}.${trimmed}` : trimmed

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || pending) return
    setPending(true)
    setError("")
    try {
      await Promise.all(
        affectedLabels.map((label) =>
          renameGroupLabelFn({
            data: {
              label: label.label,
              newLabel: newPath + label.label.slice(path.length),
              color: label.color,
              description: label.description ?? "",
            },
          })
        )
      )
      toast.success(
        affectedLabels.length > 1
          ? `Renamed "${formatLabelBreadcrumb(path)}" and ${affectedLabels.length - 1} nested label(s) to "${formatLabelBreadcrumb(newPath)}".`
          : `Renamed to "${formatLabelBreadcrumb(newPath)}".`
      )
      onOpenChange(false)
      await router.navigate({ to: `/dashboard/web/groups-by-label/${labelPathToUrlSegments(newPath).join("/")}` })
      // The sidebar's label list is loaded by the persistent dashboard shell route, which doesn't
      // re-run its loader on a navigate within its own subtree — force a refresh so it shows the new name.
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(groupLabelSaveErrorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename category</DialogTitle>
          <DialogDescription>
            {affectedLabels.length > 1
              ? `Renames "${formatLabelBreadcrumb(path)}" and the ${affectedLabels.length - 1} label(s) nested under it, keeping their colors, descriptions, and tagged groups.`
              : `Renaming "${formatLabelBreadcrumb(path)}" keeps its color, description, and any groups already tagged with it.`}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={inputId}>Name</FieldLabel>
            <Input
              id={inputId}
              value={newSegment}
              onChange={(event) => setNewSegment(event.target.value)}
              maxLength={GROUP_LABEL_MAX}
              autoFocus
              required
            />
          </Field>
          {trimmed.includes(".") && <p className="text-xs text-destructive">Use a plain name, without dots.</p>}
          {reserved && <p className="text-xs text-destructive">This name is reserved for a category.</p>}
          {trimmed && !trimmed.includes(".") && trimmed !== segment && (
            <p className="text-xs text-muted-foreground">
              Will become <span className="font-mono text-foreground">{newPath}</span>
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSave}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
