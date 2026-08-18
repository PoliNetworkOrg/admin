import { useRouter } from "@tanstack/react-router"
import { Plus, UsersRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { AssociationCard } from "./association-card"
import { AssociationDialog, type AssociationDialogState, DeleteAssociationDialog } from "./association-dialogs"
import { AssociationLinksDialog } from "./association-links-dialog"
import type { Association } from "./types"

export function AssociationsPage({ loadedAssociations }: { loadedAssociations: Association[] }) {
  const router = useRouter()
  const [associations, setAssociations] = useState(loadedAssociations)
  const [query, setQuery] = useState("")
  const [associationDialog, setAssociationDialog] = useState<AssociationDialogState | null>(null)
  const [linksDialog, setLinksDialog] = useState<Association | null>(null)
  const [deleting, setDeleting] = useState<Association | null>(null)

  useEffect(() => setAssociations(loadedAssociations), [loadedAssociations])

  const filteredAssociations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return associations
    return associations.filter((association) =>
      [association.name, association.descriptionIt, association.descriptionEn].some((value) =>
        value.toLocaleLowerCase().includes(normalized)
      )
    )
  }, [associations, query])

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
          <Button onClick={() => setAssociationDialog({ mode: "create" })}>
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
              onEdit={() => setAssociationDialog({ mode: "edit", association })}
              onEditLinks={() => setLinksDialog(association)}
              onDelete={() => setDeleting(association)}
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
          action={
            !associations.length ? (
              <Button onClick={() => setAssociationDialog({ mode: "create" })}>Add first association</Button>
            ) : undefined
          }
        />
      )}

      {associationDialog && (
        <AssociationDialog
          dialog={associationDialog}
          onClose={() => setAssociationDialog(null)}
          onSaved={(association, mode) => {
            setAssociations((current) =>
              mode === "create"
                ? [association, ...current]
                : current.map((item) => (item.id === association.id ? association : item))
            )
            setAssociationDialog(null)
            toast.success(mode === "create" ? "Association created" : "Association updated")
            void refresh()
          }}
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

      {deleting && (
        <DeleteAssociationDialog
          association={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setAssociations((current) => current.filter((association) => association.id !== id))
            setDeleting(null)
            toast.success("Association deleted")
            void refresh()
          }}
        />
      )}
    </div>
  )
}
