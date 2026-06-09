"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import CardAssociation from "./card-association"
import type { Association } from "./types"

const DEFAULT_ICON = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="currentColor" opacity=".12"/><path d="M14 31V17h8.2c3.7 0 6.3 2.4 6.3 5.8 0 3.5-2.6 5.8-6.3 5.8h-3.4V31H14Zm4.8-6.5h2.8c1.4 0 2.2-.7 2.2-1.8 0-1.1-.8-1.8-2.2-1.8h-2.8v3.6ZM30.2 31V17H35v10h6v4H30.2Z" fill="currentColor"/></svg>`

const INITIAL_DATA: Association[] = [
  {
    id: 1,
    name: "PoliNetwork",
    icon: DEFAULT_ICON,
    descriptionIt:
      "Community studentesca del Politecnico, nata per raccogliere progetti e iniziative utili agli studenti.",
    descriptionEn: "A student community at Politecnico, built around projects and initiatives useful to students.",
  },
  {
    id: 2,
    name: "PoliNetwork 2",
    icon: DEFAULT_ICON,
    descriptionIt:
      "Community studentesca del Politecnico, nata per raccogliere progetti e iniziative utili agli studenti.",
    descriptionEn: "A student community at Politecnico, built around projects and initiatives useful to students.",
  },
  {
    id: 3,
    name: "PoliNetwork 3",
    icon: DEFAULT_ICON,
    descriptionIt:
      "Community studentesca del Politecnico, nata per raccogliere progetti e iniziative utili agli studenti.",
    descriptionEn: "A student community at Politecnico, built around projects and initiatives useful to students.",
  },
]

export default function WebAssociationsIndex() {
  const [associations, setAssociations] = useState(INITIAL_DATA)
  const [editingAssociationId, setEditingAssociationId] = useState<number | null>(null)
  const [draftAssociationIds, setDraftAssociationIds] = useState<Set<number>>(new Set())

  function handleAdd() {
    const association: Association = {
      id: Date.now(),
      name: "New Association",
      icon: DEFAULT_ICON,
      descriptionIt: "Description in Italian",
      descriptionEn: "Description in English",
    }

    setAssociations((items) => [association, ...items])
    setEditingAssociationId(association.id)
    setDraftAssociationIds((ids) => new Set(ids).add(association.id))
  }

  function handleCancelCreate(id: number) {
    setAssociations((items) => items.filter((item) => item.id !== id))
    setDraftAssociationIds((ids) => {
      const nextIds = new Set(ids)
      nextIds.delete(id)
      return nextIds
    })
    setEditingAssociationId((editingId) => (editingId === id ? null : editingId))
  }

  function handleDelete(id: number) {
    setAssociations((items) => items.filter((item) => item.id !== id))
    setDraftAssociationIds((ids) => {
      const nextIds = new Set(ids)
      nextIds.delete(id)
      return nextIds
    })
    setEditingAssociationId((editingId) => (editingId === id ? null : editingId))
  }

  function handleSave(id: number, values: Association) {
    setAssociations((items) => items.map((item) => (item.id === id ? { ...item, ...values } : item)))
    setDraftAssociationIds((ids) => {
      const nextIds = new Set(ids)
      nextIds.delete(id)
      return nextIds
    })
    setEditingAssociationId((editingId) => (editingId === id ? null : editingId))
  }

  return (
    <div className="container space-y-6">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
            Associations
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage and view associations displayed on the web platform.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <PlusIcon className="size-4" />
          Add Association
        </Button>
      </div>

      <div className="grid gap-4">
        {associations.map((item) => (
          <CardAssociation
            key={item.id}
            id={item.id}
            name={item.name}
            icon={item.icon}
            descriptionIt={item.descriptionIt}
            descriptionEn={item.descriptionEn}
            initialEditActive={editingAssociationId === item.id}
            isDraft={draftAssociationIds.has(item.id)}
            onCancelCreate={() => handleCancelCreate(item.id)}
            onDelete={() => handleDelete(item.id)}
            onSave={(values) => handleSave(item.id, values)}
          />
        ))}
      </div>
    </div>
  )
}
