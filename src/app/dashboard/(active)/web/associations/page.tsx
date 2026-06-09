import { trpc } from "@/server/trpc"
import { AssociationsList } from "./associations-list"
import type { Association } from "./types"

export default async function WebAssociationsIndex() {
  const associations: Association[] = await trpc.web.associations.getAllAssociations.query()

  return (
    <div className="container space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
          Associations
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Manage and view associations displayed on the web platform.
        </p>
      </div>

      <AssociationsList initialAssociations={associations} />
    </div>
  )
}
