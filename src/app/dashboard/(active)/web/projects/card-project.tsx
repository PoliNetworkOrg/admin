"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import { Languages, Link, LucidePencil, Save, Upload, X } from "lucide-react"
import type { ChangeEvent } from "react"
import { useState } from "react"
import { ProjectCategoryMenu } from "@/app/dashboard/(active)/web/projects/category-menu"
import { DeleteDialog } from "@/components/delete-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getInitials } from "@/lib/utils"
import { cn } from "@/lib/utils/shadcn"
import type { CardProjectProps } from "./types"

export default function CardProject(item: CardProjectProps) {
  const { ref } = useSortable({
    id: item.id,
    index: item.sortableIndex ?? 0,
    group: item.category,
    disabled: item.sortableIndex === undefined,
  })
  const iconInputId = `project-icon-${item.id}`
  const [editActive, setEditActive] = useState(item.initialEditActive ?? false)
  const [title, setTitle] = useState(item.title)
  const [logo, setLogo] = useState(item.logo)
  const [descriptionIt, setDescriptionIt] = useState(item.descriptionIt)
  const [descriptionEn, setDescriptionEn] = useState(item.descriptionEn)
  const [link, setLinks] = useState(item.link)
  const [pending, setPending] = useState(false)
  const initials = getInitials(title)

  async function handleIconUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLogo(await file.text())
  }

  // If it's draft, remove the card, otherwise reset the values to the original ones
  function handleCancelEdit() {
    if (item.isDraft) {
      item.onCancelCreate?.()
      return
    }

    setTitle(item.title)
    setLogo(item.logo)
    setDescriptionIt(item.descriptionIt)
    setDescriptionEn(item.descriptionEn)
    setLinks(item.link)
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
        title,
        logo,
        descriptionIt,
        descriptionEn,
        link,
        category: item.category,
      })
      if (saved) setEditActive(false)
    } finally {
      setPending(false)
    }
  }

  function renderIcon() {
    if (logo) {
      return (
        <span
          className="flex size-11 items-center justify-center text-foreground [&_svg]:size-full"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: logo }}
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
    <Card ref={ref} key={item.id} className="border border-border bg-card">
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
                  aria-label={`Upload ${title} icon`}
                  className="sr-only"
                />
              </label>
              <div className="grid w-full gap-2">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="text-lg font-medium"
                />
              </div>
            </>
          ) : (
            <>
              {renderIcon()}
              {title}
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
                aria-label={`Save ${title}`}
              >
                <Save className="size-4" />
              </Button>
              <Button
                type="button"
                variant="error"
                size="icon"
                disabled={pending}
                onClick={handleCancelEdit}
                aria-label={`Close ${title}`}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <ProjectCategoryMenu category={item.category} onCategoryChange={item.onCategoryChange} />

              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={() => setEditActive(true)}
                aria-label={`Edit ${title}`}
              >
                <LucidePencil className="size-4" />
              </Button>
              <DeleteDialog category="Project" name={title} onConfirm={item.onDelete} />
            </>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2 col-span-2">
          <Badge variant="default">
            <Link className="size-3" />
            Link
          </Badge>
          <Input
            value={link ?? ""}
            readOnly={!editActive}
            onChange={(event) => setLinks(event.target.value)}
            className={cn(
              "border-0 bg-transparent p-3 shadow-none",
              !editActive &&
                "cursor-default resize-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent"
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Badge variant="default">
            <Languages className="size-3" />
            IT
          </Badge>
          <Textarea
            aria-label={`${title} Italian description`}
            value={descriptionIt}
            readOnly={!editActive}
            onChange={(event) => setDescriptionIt(event.target.value)}
            className={cn(
              "min-h-25 border-0 bg-transparent p-3 shadow-none",
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
            aria-label={`${title} English description`}
            value={descriptionEn}
            readOnly={!editActive}
            onChange={(event) => setDescriptionEn(event.target.value)}
            className={cn(
              "min-h-25 border-0 bg-transparent p-3 shadow-none",
              !editActive &&
                "cursor-default resize-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent"
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
