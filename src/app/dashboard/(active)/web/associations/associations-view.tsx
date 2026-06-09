"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"
import WebHeader from "@/components/web-header"
import CardAssociation from "./card-association"
import type { Association } from "./types"

export function AssociationsView({ initialAssociations }: { initialAssociations: Association[] }) {
  const [associations, setAssociations] = useState(initialAssociations)
  const [editingAssociationId, setEditingAssociationId] = useState<number | null>(null)
  const [draftAssociationIds, setDraftAssociationIds] = useState<Set<number>>(new Set())

  function handleAdd() {
    const association: Association = {
      id: Date.now(),
      name: "New Association",
      logoSvg: null,
      descriptionIt: "Description in Italian",
      descriptionEn: "Description in English",
    }

    setAssociations((items) => [association, ...items])
    setEditingAssociationId(association.id)
    setDraftAssociationIds((ids) => new Set(ids).add(association.id))
  }

  function removeAssociation(id: number) {
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
    <>
      <WebHeader
        title="Associations"
        description="Manage and view associations displayed on the web platform."
        action={{
          label: "Add Association",
          icon: <PlusIcon className="size-4" />,
          onClick: handleAdd,
        }}
      />

      <div className="grid gap-4">
        {associations.length === 0 && (
          <div className="grid min-h-64 place-items-center">
            <p className="text-center text-lg text-muted-foreground">
              No associations found. Click "Add Association" to create one.
            </p>
          </div>
        )}
        {associations.map((item) => (
          <CardAssociation
            key={item.id}
            id={item.id}
            name={item.name}
            logoSvg={item.logoSvg}
            descriptionIt={item.descriptionIt}
            descriptionEn={item.descriptionEn}
            initialEditActive={editingAssociationId === item.id}
            isDraft={draftAssociationIds.has(item.id)}
            onCancelCreate={() => removeAssociation(item.id)}
            onDelete={() => removeAssociation(item.id)}
            onSave={(values) => handleSave(item.id, values)}
          />
        ))}
      </div>
    </>
  )
}
