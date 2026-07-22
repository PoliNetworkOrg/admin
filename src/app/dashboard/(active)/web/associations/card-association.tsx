"use client"

import { Languages, LucidePencil, Save, Upload, X } from "lucide-react"
import Image from "next/image"
import type { ChangeEvent } from "react"
import { useEffect, useState } from "react"
import { DeleteDialog } from "@/components/delete-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getInitials } from "@/lib/utils"
import { cn } from "@/lib/utils/shadcn"
import { AssociationLinksDialog } from "./association-links"
import type { Association, AssociationLinks, AssociationSaveValues } from "./types"

export default function CardAssociation(
  item: Association & {
    initialEditActive?: boolean
    isDraft?: boolean
    onCancelCreate?: () => void
    onDelete: () => void
    onSave: (values: AssociationSaveValues) => boolean | Promise<boolean>
    onSaveLinks: (links: AssociationLinks) => boolean | Promise<boolean>
  }
) {
  const iconInputId = `association-icon-${item.id}`
  const [editActive, setEditActive] = useState(item.initialEditActive ?? false)
  const [name, setName] = useState(item.name)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [descriptionIt, setDescriptionIt] = useState(item.descriptionIt)
  const [descriptionEn, setDescriptionEn] = useState(item.descriptionEn)
  const [links, setLinks] = useState(item.links)
  const [pending, setPending] = useState(false)
  const initials = getInitials(name)

  async function handleIconUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  // If it's draft, remove the card, otherwise reset the values to the original ones
  function handleCancelEdit() {
    if (item.isDraft) {
      item.onCancelCreate?.()
      return
    }

    setName(item.name)
    setLogoFile(null)
    setLogoPreview(null)
    setDescriptionIt(item.descriptionIt)
    setDescriptionEn(item.descriptionEn)
    setLinks(item.links)
    setEditActive(false)
  }

  // TODO: forse spostare la cosa salvata per ultima nella lista? Perche poi ordinata per id finisce li
  // se gli id sono crescenti. O tipo la creo direttamente ultima e non in cima? Pero poi devi scorrere per editarla
  async function saveChanges() {
    if (pending) return

    setPending(true)
    try {
      const saved = await item.onSave({
        id: item.id,
        name,
        logoFile,
        descriptionIt,
        descriptionEn,
        links,
        logo: null,
      })
      if (saved) {
        setLogoFile(null)
        setLogoPreview(null)
        setEditActive(false)
      }
    } finally {
      setPending(false)
    }
  }

  async function saveLinks(nextLinks: AssociationLinks) {
    const saved = await item.onSaveLinks(nextLinks)
    if (saved) setLinks(nextLinks)
    return saved
  }

  function renderIcon() {
    const logoSource = logoPreview ?? item.logo
    if (logoSource) {
      return <Image src={logoSource} alt="" width={44} height={44} unoptimized className="size-full object-contain" />
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
                  accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
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
                variant="success"
                size="icon"
                disabled={pending}
                onClick={() => saveChanges()}
                aria-label={`Save ${name}`}
              >
                <Save className="size-4" />
              </Button>
              <Button
                type="button"
                variant="error"
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
              <AssociationLinksDialog name={name} links={links} onSave={saveLinks} />
              <Button
                type="button"
                variant="default"
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
        <div className="flex flex-col gap-2">
          <Badge variant="default">
            <Languages className="size-3" />
            IT
          </Badge>
          <Textarea
            aria-label={`${name} Italian description`}
            value={descriptionIt}
            readOnly={!editActive}
            onChange={(event) => setDescriptionIt(event.target.value)}
            className={cn(
              "min-h-32 border-0 bg-transparent p-3 shadow-none",
              !editActive &&
                "cursor-default resize-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent"
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Badge variant="default">
            <Languages className="size-3" />
            EN
          </Badge>
          <Textarea
            aria-label={`${name} English description`}
            value={descriptionEn}
            readOnly={!editActive}
            onChange={(event) => setDescriptionEn(event.target.value)}
            className={cn(
              "min-h-32 border-0 bg-transparent p-3 shadow-none",
              !editActive &&
                "cursor-default resize-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent"
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
