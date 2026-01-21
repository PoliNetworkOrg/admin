import { getQueryClient, trpc } from "@/lib/trpc/server"
export const dynamic = "force-dynamic"

export default async function TestTRPCPage() {
  const queryClient = getQueryClient()
  const rows = await queryClient.fetchQuery(trpc.test.dbQuery.queryOptions({ dbName: "tg" }))

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <p>Test with tRPC. Get the table `test.tg`</p>
      <ol className="list-inside px-4">
        {rows.map((r, i) => (
          <li key={i} className="flex-1 list-decimal">
            {r}
          </li>
        ))}
      </ol>
    </div>
  )
}
