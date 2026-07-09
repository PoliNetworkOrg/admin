"use client"

import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import WebHeader from "@/components/web-header"
import { createAssociation, deleteAssociation, editAssociation, editAssociationLinks } from "@/server/actions/web"
import CardAssociation from "./card-association"
import { EMPTY_ASSOCIATION_LINKS } from "./constants"
import type { Association, AssociationLinks, AssociationSaveValues } from "./types"

export function AssociationsView({ initialAssociations }: { initialAssociations: Association[] }) {
  const router = useRouter()
  const [associations, setAssociations] = useState(initialAssociations)
  const [editingAssociationId, setEditingAssociationId] = useState<number | null>(null)
  const [draftAssociationIds, setDraftAssociationIds] = useState<Set<number>>(new Set())

  // Creates a new temporary association, id will not be saved and will be replaced
  function handleAdd() {
    const association: Association = {
      id: Date.now(),
      name: "New Association",
      logo: null,
      descriptionIt: "Description in Italian",
      descriptionEn: "Description in English",
      links: EMPTY_ASSOCIATION_LINKS,
    }

    setAssociations((items) => [association, ...items])
    setEditingAssociationId(association.id)
    setDraftAssociationIds((ids) => new Set(ids).add(association.id))
  }

  function removeAssociationLocally(id: number) {
    setAssociations((items) => items.filter((item) => item.id !== id))
    setDraftAssociationIds((ids) => {
      const nextIds = new Set(ids)
      nextIds.delete(id)
      return nextIds
    })
    setEditingAssociationId((editingId) => (editingId === id ? null : editingId))
  }

  async function handleDelete(id: number) {
    if (draftAssociationIds.has(id)) {
      removeAssociationLocally(id)
      return
    }

    try {
      const result = await deleteAssociation(id)

      if (result.error === "UNAUTHORIZED") {
        toast.error("You don't have permission to delete associations.")
        return
      } else if (result.error === "NOT_FOUND") {
        toast.info("This association was already deleted.")
      } else {
        toast.success("Association deleted successfully.")
      }

      removeAssociationLocally(id)
      router.refresh()
    } catch (_e) {
      toast.error("There was an error deleting the association.")
    }
  }

  // Draft ne crea una nuova, altrimenti modifica quella esistente
  async function handleSave(id: number, values: AssociationSaveValues) {
    try {
      const isDraft = draftAssociationIds.has(id)
      const result = isDraft
        ? await createAssociation({
            name: values.name,
            descriptionIt: values.descriptionIt,
            descriptionEn: values.descriptionEn,
            logoFile: values.logoFile,
          })
        : await editAssociation({
            id,
            name: values.name,
            descriptionIt: values.descriptionIt,
            descriptionEn: values.descriptionEn,
            logoFile: values.logoFile,
          })

      if (result.error === "UNAUTHORIZED") {
        toast.error("You don't have permission to save associations.")
        return false
      } else if (result.error === "NOT_FOUND") {
        toast.error("This association does not exist anymore.")
        return false
      } else if (!result.association) {
        toast.error("There was an error saving the association.")
        return false
      }

      // anche qui, se facessi il refresh perderei gli altri edit locali
      setAssociations((items) => items.map((item) => (item.id === id ? result.association : item)))
      setDraftAssociationIds((ids) => {
        const nextIds = new Set(ids)
        nextIds.delete(id)
        return nextIds
      })
      setEditingAssociationId((editingId) => (editingId === id ? null : editingId))
      toast.success(`Association ${isDraft ? "created" : "updated"} successfully.`)
      router.refresh()
      // Mi ritorna true cosi poi chiudo l'edit della card
      return true
    } catch (_e) {
      toast.error("There was an error saving the association.")
      return false
    }
  }

  async function handleSaveLinks(id: number, links: AssociationLinks) {
    try {
      const result = await editAssociationLinks({ id, links })

      if (result.error === "UNAUTHORIZED") {
        toast.error("You don't have permission to save association links.")
        return false
      } else if (result.error === "NOT_FOUND") {
        toast.error("This association does not exist anymore.")
        return false
      } else if (!result.association) {
        toast.error("There was an error saving the association links.")
        return false
      }

      setAssociations((items) =>
        items.map((item) => (item.id === id ? { ...item, links: result.association.links } : item))
      )
      toast.success("Association links updated successfully.")
      router.refresh()
      return true
    } catch (_e) {
      toast.error("There was an error saving the association links.")
      return false
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <WebHeader
        title="Associations"
        description="Manage and view associations displayed on the web platform."
        action={{
          label: "Add Association",
          icon: <PlusIcon className="size-4" />,
          onClick: handleAdd,
        }}
      />

      <div className="grid w-full gap-4">
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
            logo={item.logo}
            descriptionIt={item.descriptionIt}
            descriptionEn={item.descriptionEn}
            links={item.links}
            initialEditActive={editingAssociationId === item.id}
            isDraft={draftAssociationIds.has(item.id)}
            onCancelCreate={() => removeAssociationLocally(item.id)}
            onDelete={() => handleDelete(item.id)}
            onSave={(values) => handleSave(item.id, values)}
            onSaveLinks={(links) => handleSaveLinks(item.id, links)}
          />
        ))}
      </div>
    </div>
  )
}
