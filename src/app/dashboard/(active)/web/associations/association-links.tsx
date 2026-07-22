"use client"

import { Link, Save } from "lucide-react"
import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LINK_FIELDS } from "./constants"
import type { AssociationLinks } from "./types"

function normalizeLinks(links: AssociationLinks) {
  return Object.fromEntries(
    LINK_FIELDS.map((field) => {
      const value = links[field.key]?.trim()
      return [field.key, value || null]
    })
  ) as AssociationLinks
}

export function AssociationLinksDialog({
  name,
  links,
  onSave,
}: {
  name: string
  links: AssociationLinks
  onSave: (links: AssociationLinks) => boolean | Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [draftLinks, setDraftLinks] = useState(links)

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (value) setDraftLinks(links)
  }

  async function handleSave() {
    if (pending) return

    setPending(true)
    try {
      const saved = await onSave(normalizeLinks(draftLinks))
      if (saved) setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="icon" aria-label={`Edit ${name} links`}>
            <Link className="size-4" />
          </Button>
        }
      />

      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{name} links</DialogTitle>
          <DialogDescription>Manage the public links for this association.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          {LINK_FIELDS.map((field) => {
            const FieldIcon = field.icon

            return (
              <div className="grid gap-3" key={field.key}>
                <Label htmlFor={`${name}-${field.key}`}>
                  <FieldIcon className="size-4" />
                  {field.label}
                </Label>
                <Input
                  id={`${name}-${field.key}`}
                  value={draftLinks[field.key] ?? ""}
                  onChange={(event) =>
                    setDraftLinks((currentLinks) => ({
                      ...currentLinks,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" disabled={pending} onClick={handleSave}>
            <Save className="size-4" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
