import { CreateAssocUser } from "@/components/create-assoc-member"
import { getQueryClient, trpc } from "@/lib/trpc/server"

export default async function AssocIndex() {
  const qc = getQueryClient()
  const members = await qc.fetchQuery(trpc.azure.members.getAll.queryOptions())
  if (members.error) return <div>Error: {members.error}</div>

  return (
    <div className="space-y-3 container p-8">
      <p>{members.members.length} soci registrati</p>
      <CreateAssocUser />
      {members.members
        // biome-ignore lint/style/noNonNullAssertion: got it
        .sort((a, b) => parseInt(a.employeeId!, 10) - parseInt(b.employeeId!, 10))
        // .sort((a, b) => a.displayName!.localeCompare(b.displayName!))
        .map((m) => (
          <div className="grid gap-2 grid-cols-4 items-center" key={m.id}>
            <span>{m.displayName}</span>
            <span>{m.employeeId ?? "N/A"}</span>
            <span>{m.mail}</span>
            <span className="text-xs text-muted-foreground">{m.assignedLicensesIds.join(", ")}</span>
          </div>
        ))}
    </div>
  )
}
