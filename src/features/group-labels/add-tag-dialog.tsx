import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle } from "lucide-react"
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
import { isReservedCategoryRoot, isValidLabelSegment } from "./label-tree"

/** Creates a flat attribute tag (e.g. a language or campus facet). Tags never nest, unlike a category. */
export function AddTagDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const nameId = useId()

  const trimmed = name.trim()
  const reserved = isReservedCategoryRoot(trimmed)
  const canSave = isValidLabelSegment(trimmed) && !reserved

  function reset() {
    setName("")
    setError("")
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || pending) return
    setPending(true)
    setError("")
    try {
      await createGroupLabelFn({ data: { label: trimmed, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
      toast.success(`Tag "${trimmed}" created.`)
      onOpenChange(false)
      reset()
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
          <DialogTitle>Add tag</DialogTitle>
          <DialogDescription>
            A flat attribute, like a language or campus. Tags aren&apos;t nested — for a browsable category, use
            &quot;Add category&quot; instead.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Italian, Bovisa"
              maxLength={GROUP_LABEL_MAX}
              autoFocus
              required
            />
          </Field>
          {!isValidLabelSegment(trimmed) && trimmed && (
            <p className="text-xs text-destructive">Use a plain name, without dots or URL separators.</p>
          )}
          {reserved && <p className="text-xs text-destructive">This name is reserved for a category.</p>}
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
              Add tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
