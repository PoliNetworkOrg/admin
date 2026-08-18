import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ASSOCIATION_LINK_FIELDS } from "./associations.constants"
import { editAssociationLinks } from "./associations.functions"
import type { Association, AssociationLinks } from "./types"

function normalizeLinks(links: AssociationLinks): AssociationLinks {
  return Object.fromEntries(
    ASSOCIATION_LINK_FIELDS.map(({ key }) => {
      const value = links[key]?.trim()
      return [key, value || null]
    })
  ) as AssociationLinks
}

export function AssociationLinksDialog({
  association,
  onClose,
  onSaved,
}: {
  association: Association
  onClose: () => void
  onSaved: (association: Association) => void
}) {
  const [links, setLinks] = useState(association.links)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const editLinksFn = useServerFn(editAssociationLinks)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      onSaved(await editLinksFn({ data: { id: association.id, links: normalizeLinks(links) } }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      setError(
        message.includes("NOT_FOUND")
          ? "This association no longer exists."
          : "The links could not be saved. Check the values and your permissions."
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">
            WEB · ASSOCIATION LINKS
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">{association.name} links</DialogTitle>
          <DialogDescription>Manage the public contact and social profiles for this association.</DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 md:grid-cols-2">
            {ASSOCIATION_LINK_FIELDS.map((field) => {
              const Icon = field.icon
              return (
                <Field key={field.key}>
                  <FieldLabel htmlFor={`association-${association.id}-${field.key}`}>
                    <Icon className="size-3.5" /> {field.label}
                  </FieldLabel>
                  <Input
                    id={`association-${association.id}-${field.key}`}
                    type={field.key === "email" ? "email" : "url"}
                    value={links[field.key] ?? ""}
                    placeholder={field.placeholder}
                    maxLength={2_048}
                    onChange={(event) =>
                      setLinks((current) => ({ ...current, [field.key]: event.target.value || null }))
                    }
                  />
                </Field>
              )
            })}
          </div>
          {error && <FieldError className="mt-4">{error}</FieldError>}
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Save links
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
