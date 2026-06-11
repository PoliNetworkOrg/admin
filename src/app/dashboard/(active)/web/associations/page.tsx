import { trpc } from "@/server/trpc"
import { AssociationsView } from "./associations-view"
import type { Association } from "./types"

export default async function WebAssociationsIndex() {
  const associations: Association[] = await trpc.web.associations.getAllAssociations.query()

  return (
    <div className="container space-y-6">
      <AssociationsView initialAssociations={associations} />
    </div>
  )
}
