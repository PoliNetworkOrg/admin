"use client"

import { Languages, LucidePencil, Save, Upload, X } from "lucide-react"
import type { ChangeEvent } from "react"
import { useId, useState } from "react"
import { DeleteDialog } from "@/components/delete-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Association } from "./types"

export default function CardAssociation(
  item: Association & {
    initialEditActive?: boolean
    isDraft?: boolean
    onCancelCreate?: () => void
    onDelete: () => void
    onSave: (values: Association) => void
  }
) {
  const iconInputId = useId()
  const [editActive, setEditActive] = useState(item.initialEditActive ?? false)
  const [name, setName] = useState(item.name)
  const [logoSvg, setLogoSvg] = useState(item.logoSvg)
  const [descriptionIt, setDescriptionIt] = useState(item.descriptionIt)
  const [descriptionEn, setDescriptionEn] = useState(item.descriptionEn)

  async function handleIconUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setLogoSvg(await file.text())
  }

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

  // TODO: implement save logic
  function saveChanges() {
    item.onSave({ id: item.id, name, logoSvg, descriptionIt, descriptionEn })
    setEditActive(false)
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
                <span
                  className="flex size-11 items-center justify-center [&_svg]:size-full"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: logoSvg ?? "" }}
                />
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
              <span
                className="flex size-11 items-center justify-center text-foreground [&_svg]:size-full"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: logoSvg ?? "" }}
              />
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
                onClick={() => saveChanges()}
                aria-label={`Save ${name}`}
              >
                <Save className="size-4" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon"
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
