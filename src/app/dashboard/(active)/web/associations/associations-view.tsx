"use client"

import { PlusIcon } from "lucide-react"
import { useState } from "react"
import WebHeader from "@/components/web-header"
import { AssociationsList } from "./associations-list"
import type { Association } from "./types"

const DEFAULT_ICON = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="currentColor" opacity=".12"/><path d="M14 31V17h8.2c3.7 0 6.3 2.4 6.3 5.8 0 3.5-2.6 5.8-6.3 5.8h-3.4V31H14Zm4.8-6.5h2.8c1.4 0 2.2-.7 2.2-1.8 0-1.1-.8-1.8-2.2-1.8h-2.8v3.6ZM30.2 31V17H35v10h6v4H30.2Z" fill="currentColor"/></svg>`

export function AssociationsView({ initialAssociations }: { initialAssociations: Association[] }) {
  const [associations, setAssociations] = useState(initialAssociations)
  const [editingAssociationId, setEditingAssociationId] = useState<number | null>(null)
  const [draftAssociationIds, setDraftAssociationIds] = useState<Set<number>>(new Set())

  function handleAdd() {
    const association: Association = {
      id: Date.now(),
      name: "New Association",
      logoSvg: DEFAULT_ICON,
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
