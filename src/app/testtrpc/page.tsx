import { testDb } from "@/server/actions/test"
export const dynamic = "force-dynamic"

export default async function TestTRPCPage() {
  const data = await testDb()

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <p>Test with tRPC. Get the table `test.tg`</p>
      <ol className="list-inside px-4">
        {data.map((r, i) => (
          <li key={i} className="flex-1 list-decimal">
            {r}
          </li>
        ))}
      </ol>
    </div>
  )
}
