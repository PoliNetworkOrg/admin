import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, UsersRound } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { errorHasCode } from "@/lib/errors"

import { AssociationCard } from "./association-card"
import { AssociationLinksDialog } from "./association-links-dialog"
import { EMPTY_ASSOCIATION_LINKS } from "./associations.constants"
import { createAssociation, deleteAssociation, editAssociation } from "./associations.functions"
import { associationSaveErrorMessage } from "./associations.validation"
import type { Association, AssociationFormValues } from "./types"

export function AssociationsPage({ loadedAssociations }: { loadedAssociations: Association[] }) {
  const router = useRouter()
  const createAssociationFn = useServerFn(createAssociation)
  const editAssociationFn = useServerFn(editAssociation)
  const deleteAssociationFn = useServerFn(deleteAssociation)
  const [associations, setAssociations] = useState(loadedAssociations)
  const [query, setQuery] = useState("")
  const [draftAssociationIds, setDraftAssociationIds] = useState<Set<number>>(new Set())
  const [linksDialog, setLinksDialog] = useState<Association | null>(null)
  const draftAssociationIdsRef = useRef(draftAssociationIds)

  useEffect(() => {
    setAssociations((current) => {
      const drafts = current.filter((association) => draftAssociationIdsRef.current.has(association.id))
      return drafts.length ? [...drafts, ...loadedAssociations] : loadedAssociations
    })
  }, [loadedAssociations])

  const filteredAssociations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return associations
    return associations.filter(
      (association) =>
        draftAssociationIds.has(association.id) ||
        [association.name, association.descriptionIt, association.descriptionEn].some((value) =>
          value.toLocaleLowerCase().includes(normalized)
        )
    )
  }, [associations, draftAssociationIds, query])

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the association list could not be refreshed.")
    }
  }

  function replaceAssociation(association: Association) {
    setAssociations((current) => current.map((item) => (item.id === association.id ? association : item)))
  }

  function removeDraftAssociationId(id: number) {
    const nextDraftIds = new Set(draftAssociationIdsRef.current)
    nextDraftIds.delete(id)
    draftAssociationIdsRef.current = nextDraftIds
    setDraftAssociationIds(nextDraftIds)
  }

  function addAssociation() {
    const draft: Association = {
      id: -Date.now(),
      name: "New association",
      descriptionIt: "",
      descriptionEn: "",
      logo: null,
      links: { ...EMPTY_ASSOCIATION_LINKS },
    }
    setAssociations((current) => [draft, ...current])
    const nextDraftIds = new Set(draftAssociationIdsRef.current).add(draft.id)
    draftAssociationIdsRef.current = nextDraftIds
    setDraftAssociationIds(nextDraftIds)
  }

  function cancelDraft(id: number) {
    setAssociations((current) => current.filter((association) => association.id !== id))
    removeDraftAssociationId(id)
  }

  async function saveAssociation(id: number, values: AssociationFormValues) {
    const draft = draftAssociationIdsRef.current.has(id)
    const data = new FormData()
    if (!draft) data.set("id", String(id))
    data.set("name", values.name)
    data.set("descriptionIt", values.descriptionIt)
    data.set("descriptionEn", values.descriptionEn)
    data.set("logo", values.logo ?? "")
    if (values.logoFile) data.set("logo", values.logoFile)

    try {
      const saved = draft ? await createAssociationFn({ data }) : await editAssociationFn({ data })
      setAssociations((current) => current.map((association) => (association.id === id ? saved : association)))
      if (draft) removeDraftAssociationId(id)
      toast.success(`Association ${draft ? "created" : "updated"}`)
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      toast.error(associationSaveErrorMessage(cause))
      return false
    }
  }

  async function removeAssociation(id: number) {
    if (draftAssociationIdsRef.current.has(id)) {
      cancelDraft(id)
      return true
    }

    try {
      await deleteAssociationFn({ data: { id } })
      setAssociations((current) => current.filter((association) => association.id !== id))
      toast.success("Association deleted")
      void refresh()
      return true
    } catch (cause) {
      console.error(cause)
      if (errorHasCode(cause, "NOT_FOUND")) {
        setAssociations((current) => current.filter((association) => association.id !== id))
        toast.success("Association deleted")
        void refresh()
        return true
      }
      toast.error("The association could not be deleted. Check your permissions and try again.")
      return false
    }
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Associations"
        description="Manage the associations and public information displayed on the PoliNetwork website."
        count={filteredAssociations.length}
        total={associations.length}
        searchPlaceholder="Search associations…"
        onSearch={setQuery}
        action={
          <Button onClick={addAssociation}>
            <Plus data-icon="inline-start" /> Add association
          </Button>
        }
      />

      {filteredAssociations.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredAssociations.map((association) => (
            <AssociationCard
              key={association.id}
              association={association}
              draft={draftAssociationIds.has(association.id)}
              initialEditActive={draftAssociationIds.has(association.id)}
              onCancelDraft={() => cancelDraft(association.id)}
              onDelete={() => removeAssociation(association.id)}
              onEditLinks={() => setLinksDialog(association)}
              onSave={(values) => saveAssociation(association.id, values)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title={associations.length ? "No association matches this search" : "No associations yet"}
          text={
            associations.length
              ? "Try a different name or description."
              : "Add the first association shown on the public website."
          }
          action={!associations.length ? <Button onClick={addAssociation}>Add first association</Button> : undefined}
        />
      )}

      {linksDialog && (
        <AssociationLinksDialog
          association={linksDialog}
          onClose={() => setLinksDialog(null)}
          onSaved={(association) => {
            replaceAssociation(association)
            setLinksDialog(null)
            toast.success("Association links updated")
            void refresh()
          }}
        />
      )}
    </div>
  )
}
