import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/server/trpc"
import type { ApiOutput } from "@/server/trpc/types"

type Users = NonNullable<ApiOutput["tg"]["users"]["getAll"]["users"]>

export default async function TgUsers() {
  const data = await trpc.tg.users.getAll.query()
  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="flex flex-col w-full items-start justify-start py-4">
        <div className="grid gap-4 items-center grid-cols-3 w-full border-b py-2 font-bold">
          <p>Telegram ID</p>
          <p>Username</p>
          <p>Name</p>
        </div>
        {data?.users?.map((r) => (
          <UserRow row={r} key={r.id} />
        ))}
      </div>
    </div>
  )
}

function UserRow({ row: r }: { row: Users[number] }) {
  return (
    <div className="grid gap-4 items-center grid-cols-3 border-b py-2 w-full">
      <p>{r.id}</p>
      <p className={r.username ? "" : "text-muted-foreground italic"}>{r.username ? `@${r.username}` : `<unset>`}</p>
      <p>
        {r.firstName ?? ""} {r.lastName ?? ""}
      </p>
    </div>
  )
}
