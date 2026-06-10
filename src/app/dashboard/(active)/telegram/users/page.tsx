import { Eye, ViewIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { trpc } from "@/server/trpc"
import type { ApiOutput } from "@/server/trpc/types"

type Users = NonNullable<ApiOutput["tg"]["users"]["getAll"]["users"]>

export default async function TgUsers() {
  const data = await trpc.tg.users.getAll.query()
  return (
    <div className="container">
      <p className="text-sm text-muted-foreground">
        Count: <span className="text-foreground">{data.users?.length}</span>
      </p>
      <div className="flex flex-col w-full items-start justify-start py-4">
        <div className="grid gap-4 items-center grid-cols-4 w-full border-b py-2 font-bold">
          <p>Telegram ID</p>
          <p>Username</p>
          <p>Name</p>
          <p className="text-end">Actions</p>
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
    <div className="grid gap-4 items-center grid-cols-4 border-b py-2 w-full">
      <p>{r.id}</p>
      <p className={r.username ? "" : "text-muted-foreground italic"}>{r.username ? `@${r.username}` : `<unset>`}</p>
      <p>
        {r.firstName ?? ""} {r.lastName ?? ""}
      </p>
      <div className="flex justify-end gap-2 items-center">
        <Link href={`/dashboard/telegram/users/${r.id}`}>
          <Button size="icon">
            <Eye />
          </Button>
        </Link>
      </div>
    </div>
  )
}
