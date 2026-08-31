import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Plus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel } from "@/features/group-labels/group-labels.functions"
import { formatLabelBreadcrumb, labelPathToUrlSegments } from "@/features/group-labels/label-tree"
import { errorMessage } from "@/lib/errors"

export function AddChildLabelDialog({
  path,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  path: string
  /** Pass both to drive the dialog externally (e.g. from a sidebar menu item) instead of rendering its own button. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen
  const [segment, setSegment] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const segmentId = useId()

  const trimmed = segment.trim()
  const canSave = trimmed.length > 0 && !trimmed.includes(".")

  function reset() {
    setSegment("")
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || pending) return
    setPending(true)
    setError("")
    const childPath = `${path}.${trimmed}`
    try {
      await createGroupLabelFn({ data: { label: childPath, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
      toast.success(`"${childPath}" created.`)
      setOpen(false)
      reset()
      await router.navigate({ to: `/dashboard/web/groups-by-label/${labelPathToUrlSegments(childPath).join("/")}` })
      // The sidebar's label list is loaded by the persistent dashboard shell route, which doesn't
      // re-run its loader on a navigate within its own subtree — force a refresh so the new node appears.
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, `"${childPath}" could not be created. Try a different name.`))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      {!isControlled && (
        <DialogTrigger render={<Button variant="outline" />}>
          <Plus data-icon="inline-start" /> Add category
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add sub-category</DialogTitle>
          <DialogDescription>
            Creates a new category nested under{" "}
            <strong className="text-foreground">{formatLabelBreadcrumb(path)}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={segmentId}>Name</FieldLabel>
            <Input
              id={segmentId}
              value={segment}
              onChange={(event) => setSegment(event.target.value)}
              placeholder="sub-category"
              autoFocus
              required
            />
          </Field>
          {trimmed && !trimmed.includes(".") && (
            <p className="text-xs text-muted-foreground">
              Will be created as{" "}
              <span className="font-mono text-foreground">
                {path}.{trimmed}
              </span>
            </p>
          )}
          {trimmed.includes(".") && <p className="text-xs text-destructive">Use a plain name, without dots.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSave}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              Add category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
