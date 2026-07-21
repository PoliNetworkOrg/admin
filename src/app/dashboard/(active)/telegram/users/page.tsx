import { Eye } from "lucide-react"
import Link from "next/link"
import { SearchInput } from "@/components/search-input"
import { Button } from "@/components/ui/button"
import { trpc } from "@/server/trpc"
import type { ApiOutput } from "@/server/trpc/types"

type Users = NonNullable<ApiOutput["tg"]["users"]["getAll"]["users"]>

export default async function TgUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const { users } = await trpc.tg.users.getAll.query()

  const data = (!q ? users : users?.filter((u) => u.username?.toLowerCase().replace("@", "").startsWith(q))) ?? []

  return (
    <div className="container">
      <SearchInput />
      <p className="text-sm text-muted-foreground">
        Count: <span className="text-foreground">{users?.length}</span>
      </p>
      <div className="flex flex-col w-full items-start justify-start">
        <div className="grid gap-4 items-center grid-cols-4 w-full border-b py-2 font-bold">
          <p>Telegram ID</p>
          <p>Username</p>
          <p>Name</p>
          <p className="text-end">Actions</p>
        </div>
        {data.length > 0 ? (
          data.map((r) => <UserRow row={r} key={r.id} />)
        ) : (
          <div className="flex gap-4 justify-center items-center border-b py-2 w-full">No users found</div>
        )}
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
          <Button size="icon" aria-label="see user details">
            <Eye />
          </Button>
        </Link>
      </div>
    </div>
  )
}
