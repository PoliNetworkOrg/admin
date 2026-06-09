"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"
import WebHeader from "@/components/web-header"
import { AssociationsList } from "./associations-list"
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

      <AssociationsList
        associations={associations}
        editingAssociationId={editingAssociationId}
        draftAssociationIds={draftAssociationIds}
        onCancelCreate={removeAssociation}
        onDelete={removeAssociation}
        onSave={handleSave}
      />
    </>
  )
}
