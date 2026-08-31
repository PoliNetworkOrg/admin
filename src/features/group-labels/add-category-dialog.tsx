import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import { useId, useState } from "react"
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
import { errorMessage } from "@/lib/errors"

import { DEFAULT_GROUP_LABEL_COLOR, GROUP_LABEL_MAX } from "./group-labels.constants"
import { createGroupLabel } from "./group-labels.functions"
import { CATEGORY_ROOTS, formatLabelSegment, isValidLabelSegment, labelPathToUrlSegments } from "./label-tree"

/** Creates a new category nested under one of the two fixed roots (Didattica, Extra) — there's no "add a new
 * root" action, since only a code change (adding to `CATEGORY_ROOTS`) can introduce a new one. */
export function AddCategoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const [root, setRoot] = useState<string | null>(null)
  const [segment, setSegment] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const segmentId = useId()

  const trimmed = segment.trim()
  const canSave = Boolean(root) && isValidLabelSegment(trimmed)

  function reset() {
    setRoot(null)
    setSegment("")
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!root || !canSave || pending) return
    setPending(true)
    setError("")
    const childPath = `${root}.${trimmed}`
    try {
      await createGroupLabelFn({ data: { label: childPath, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
      toast.success(`"${formatLabelSegment(trimmed)}" created under ${formatLabelSegment(root)}.`)
      onOpenChange(false)
      reset()
      await router.navigate({ to: `/dashboard/web/groups-by-label/${labelPathToUrlSegments(childPath).join("/")}` })
      // The sidebar's label list is loaded by the persistent dashboard shell route, which doesn't
      // re-run its loader on a navigate within its own subtree — force a refresh so it shows the new node.
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, `"${trimmed}" could not be created. Try a different name.`))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
          <DialogDescription>
            {root
              ? `Creates a new category nested under ${formatLabelSegment(root)}.`
              : "Which top-level category does this belong under?"}
          </DialogDescription>
        </DialogHeader>

        {!root ? (
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_ROOTS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setRoot(candidate)}
                className="rounded-lg border border-border p-4 text-center text-sm font-medium hover:border-primary/50 hover:bg-accent"
              >
                {formatLabelSegment(candidate)}
              </button>
            ))}
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit gap-1 text-muted-foreground"
              onClick={() => setRoot(null)}
            >
              <ArrowLeft data-icon="inline-start" className="size-3.5" /> Back
            </Button>
            <Field>
              <FieldLabel htmlFor={segmentId}>Name</FieldLabel>
              <Input
                id={segmentId}
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                placeholder="sub-category"
                maxLength={GROUP_LABEL_MAX}
                autoFocus
                required
              />
            </Field>
            {!isValidLabelSegment(trimmed) && trimmed && (
              <p className="text-xs text-destructive">Use a plain name, without dots or URL separators.</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !canSave}>
                {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
                Add category
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
