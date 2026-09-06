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
import { createGroupLabel, createReleaseLabel } from "./group-labels.functions"
import { hasReleaseLabelPrefix, isReservedCategoryRoot, isValidLabelSegment, RELEASE_LABEL_PREFIX } from "./label-tree"

/** Separate entry points for persistent attributes and temporary publication batches. */
export function AddTagDialog({
  open,
  onOpenChange,
  publication = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  publication?: boolean
}) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const createReleaseLabelFn = useServerFn(createReleaseLabel)
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const nameId = useId()

  const trimmed = name.trim()
  const reserved = !publication && isReservedCategoryRoot(trimmed)
  const reservedRelease = hasReleaseLabelPrefix(trimmed)
  const canSave =
    isValidLabelSegment(trimmed) &&
    !reserved &&
    !reservedRelease &&
    trimmed.length <= GROUP_LABEL_MAX - (publication ? RELEASE_LABEL_PREFIX.length : 0)

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
      if (publication) {
        await createReleaseLabelFn({ data: { name: trimmed, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
      } else {
        await createGroupLabelFn({ data: { label: trimmed, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
      }
      toast.success(`${publication ? "Publication" : "Tag"} "${trimmed}" created.`)
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
          <DialogTitle>{publication ? "Create publication" : "Add tag"}</DialogTitle>
          <DialogDescription>
            {publication
              ? "Create a batch of groups to publish together. Publishing makes its groups visible and clears only the batch label; categories and attributes remain."
              : "A permanent attribute, like a language or campus. Use Publications to prepare a batch for publishing."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={publication ? "e.g. 2026-27" : "e.g. Italian, Bovisa"}
              maxLength={GROUP_LABEL_MAX - (publication ? RELEASE_LABEL_PREFIX.length : 0)}
              autoFocus
              required
            />
          </Field>
          {!isValidLabelSegment(trimmed) && trimmed && (
            <p className="text-xs text-destructive">Use a plain name, without dots or URL separators.</p>
          )}
          {reservedRelease && (
            <p className="text-xs text-destructive">
              {publication
                ? "Enter the name without the release- prefix."
                : "The release- prefix is reserved. Use Create publication instead."}
            </p>
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
              {publication ? "Create publication" : "Add tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
