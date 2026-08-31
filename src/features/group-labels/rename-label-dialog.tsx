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
import { formatLabelBreadcrumb, isReservedCategoryRoot } from "./label-tree"
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
    // The backend renames each affected label one at a time with no cross-label transaction, so a rename
    // spanning several nested labels can fail partway and leave the tree split between the old and new path.
    // There's no atomic batch endpoint to call instead (would need a backend change, out of scope here), so
    // this settles every rename first and, on any failure, best-effort renames the successful ones back —
    // "all or nothing" from the admin's point of view even without a real DB transaction underneath.
    const renames = affectedLabels.map((label) => ({
      label,
      newLabel: newPath + label.label.slice(path.length),
    }))
    try {
      const results = await Promise.allSettled(
        renames.map(({ label, newLabel }) =>
          renameGroupLabelFn({
            data: { label: label.label, newLabel, color: label.color, description: label.description ?? "" },
          })
        )
      )
      const anyFailed = results.some((result) => result.status === "rejected")
      if (!anyFailed) {
        toast.success(
          affectedLabels.length > 1
            ? `Renamed "${formatLabelBreadcrumb(path)}" and ${affectedLabels.length - 1} nested label(s) to "${formatLabelBreadcrumb(newPath)}".`
            : `Renamed to "${formatLabelBreadcrumb(newPath)}".`
        )
        onOpenChange(false)
        // Both current callers (the tree row and the flat card) live on the labels management page itself, so
        // there's nowhere to navigate to — just refresh so the renamed node shows up immediately.
        await router.invalidate({ sync: true })
        return
      }

      const succeeded = renames.filter((_, index) => results[index]?.status === "fulfilled")
      const rollbackResults = await Promise.allSettled(
        succeeded.map(({ label, newLabel }) =>
          renameGroupLabelFn({
            data: { label: newLabel, newLabel: label.label, color: label.color, description: label.description ?? "" },
          })
        )
      )
      const rollbackFailed = rollbackResults.some((result) => result.status === "rejected")
      setError(
        rollbackFailed
          ? "The rename failed partway and some labels couldn't be rolled back automatically — check the category tree for leftover names."
          : "The rename couldn't be completed and was rolled back. Check your permissions and try again."
      )
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
