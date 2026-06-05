import { trpc } from "@/server/trpc"
import { GrantList } from "./grant-list"
import { NewGrant } from "./new-grant"

export default async function GrantsPage() {
  const { grants } = await trpc.tg.grants.getOngoing.query()

  return (
    <div className="container">
      <div className="flex gap-4 justify-start items-center">
        <p>Telegram Grants</p>
        <NewGrant />
      </div>
      <GrantList grants={grants} />
    </div>
  )
}
