import CardAssociation from "./card-association"
import type { Association } from "./types"

interface AssociationsListProps {
  associations: Association[]
  editingAssociationId: number | null
  draftAssociationIds: Set<number>
  onCancelCreate: (id: number) => void
  onDelete: (id: number) => void
  onSave: (id: number, values: Association) => void
}

export function AssociationsList({
  associations,
  editingAssociationId,
  draftAssociationIds,
  onCancelCreate,
  onDelete,
  onSave,
}: AssociationsListProps) {
  return (
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
          onCancelCreate={() => onCancelCreate(item.id)}
          onDelete={() => onDelete(item.id)}
          onSave={(values) => onSave(item.id, values)}
        />
      ))}
    </div>
  )
}
