"use client"

import { Languages, LucidePencil, Save, Upload, X } from "lucide-react"
import type { ChangeEvent } from "react"
import { useState } from "react"
import { DeleteDialog } from "@/components/delete-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getInitials } from "@/lib/utils"
import type { Association } from "./types"

export default function CardAssociation(
  item: Association & {
    initialEditActive?: boolean
    isDraft?: boolean
    onCancelCreate?: () => void
    onDelete: () => void
    onSave: (values: Association) => boolean | Promise<boolean>
  }
) {
  const iconInputId = `association-icon-${item.id}`
  const [editActive, setEditActive] = useState(item.initialEditActive ?? false)
  const [name, setName] = useState(item.name)
  const [logoSvg, setLogoSvg] = useState(item.logoSvg)
  const [descriptionIt, setDescriptionIt] = useState(item.descriptionIt)
  const [descriptionEn, setDescriptionEn] = useState(item.descriptionEn)
  const [pending, setPending] = useState(false)
  const initials = getInitials(name)

  async function handleIconUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoSvg(await file.text())
  }

  // If it's draft, remove the card, otherwise reset the values to the original ones
  function handleCancelEdit() {
    if (item.isDraft) {
      item.onCancelCreate?.()
      return
    }

    setName(item.name)
    setLogoSvg(item.logoSvg)
    setDescriptionIt(item.descriptionIt)
    setDescriptionEn(item.descriptionEn)
    setEditActive(false)
  }

  async function saveChanges() {
    if (pending) return

    setPending(true)
    try {
      const saved = await item.onSave({ id: item.id, name, logoSvg, descriptionIt, descriptionEn })
      if (saved) setEditActive(false)
    } finally {
      setPending(false)
    }
  }

  function renderIcon() {
    if (logoSvg) {
      return (
        <span
          className="flex size-11 items-center justify-center text-foreground [&_svg]:size-full"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
      )
    }

    return (
      <span
        className="flex size-11 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground"
        aria-hidden="true"
      >
        {initials}
      </span>
    )
  }

  return (
    <Card key={item.id} className="border border-border bg-card">
      <CardHeader className="grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1">
        <CardTitle className="flex items-center gap-3 self-center text-lg">
          {editActive ? (
            <>
              <label
                htmlFor={iconInputId}
                className="group relative flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {renderIcon()}
                <span className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Upload className="size-5" />
                </span>
                <Input
                  id={iconInputId}
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleIconUpload}
                  aria-label={`Upload ${name} icon`}
                  className="sr-only"
                />
              </label>
              <div className="grid w-full gap-2">
                <Input value={name} onChange={(event) => setName(event.target.value)} className="text-lg font-medium" />
              </div>
            </>
          ) : (
            <>
              {renderIcon()}
              {name}
            </>
          )}
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {editActive ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={pending}
                onClick={() => saveChanges()}
                aria-label={`Save ${name}`}
              >
                <Save className="size-4" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={pending}
                onClick={handleCancelEdit}
                aria-label={`Close ${name}`}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setEditActive(true)}
                aria-label={`Edit ${name}`}
              >
                <LucidePencil className="size-4" />
              </Button>
              <DeleteDialog category="Association" name={name} onConfirm={item.onDelete} />
            </>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <Badge variant="outline" className="mb-2">
            <Languages className="size-3" />
            IT
          </Badge>
          {editActive ? (
            <Textarea
              aria-label={`${name} Italian description`}
              value={descriptionIt}
              onChange={(event) => setDescriptionIt(event.target.value)}
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{descriptionIt}</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <Badge variant="outline" className="mb-2">
            <Languages className="size-3" />
            EN
          </Badge>
          {editActive ? (
            <Textarea
              aria-label={`${name} English description`}
              value={descriptionEn}
              onChange={(event) => setDescriptionEn(event.target.value)}
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{descriptionEn}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
