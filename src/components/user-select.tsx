"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import type { TgUser } from "@/lib/trpc/types"
import { fmtUser } from "@/lib/utils/telegram"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group"

type Props = {
  onUser(user: TgUser): void
  onReset(): void
}

export function UserSelect({ onUser, onReset }: Props) {
  const [user, setUser] = useState<TgUser | null>(null)
  const [searchType, setSearchType] = useState<"username" | "id">("username")
  const [username, setUsername] = useState("")
  const [id, setId] = useState("")

  const trpc = useTRPC()
  const qc = useQueryClient()

  const usernameSearch = trpc.tg.users.getByUsername.queryOptions({ username })
  const idSearch = trpc.tg.users.get.queryOptions({ userId: id ? parseInt(id, 10) : 0 })

  async function search() {
    const { user } = await qc.fetchQuery(searchType === "id" ? idSearch : usernameSearch)
    if (!user) return toast.error(`User with this ${searchType === "id" ? "ID" : "username"} not found`)
    setUser(user)
    onUser(user)
    return
  }

  async function reset() {
    setUser(null)
    setUsername("")
    setId("")
    onReset()
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await search()
  }

  return (
    <div className="flex flex-col gap-3 border p-2 w-fit rounded-lg">
      <div className="flex gap-2 items-center">
        <p className="text-sm">Search User by</p>
        <ToggleGroup
          variant="outline"
          disabled={!!user}
          value={[searchType]}
          onValueChange={(v) => v[0] && setSearchType(v[0] as "username" | "id")}
        >
          <ToggleGroupItem value="username" aria-label="Search by username">
            @ Username
          </ToggleGroupItem>
          <ToggleGroupItem value="id" aria-label="Search by id">
            # ID
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <form className="flex gap-2 items-end" onSubmit={submit}>
        {searchType === "username" && (
          <div className="space-y-1">
            <Label htmlFor="tg-username">Username</Label>
            <Input
              disabled={!!user}
              type="text"
              placeholder="@example"
              name="tg-username"
              id="tg-username"
              className="max-w-64"
              value={username}
              onChange={(v) => setUsername(v.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {searchType === "id" && (
          <div className="space-y-1">
            <Label htmlFor="tg-id">ID</Label>
            <Input
              disabled={!!user}
              type="text"
              placeholder="123456789"
              name="tg--id"
              id="tg--id"
              className="max-w-64"
              value={id}
              onChange={(v) => setId(v.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        {user ? (
          <Button size="icon" onClick={reset} type="button">
            <X />
          </Button>
        ) : (
          <Button size="icon" onClick={search} type="button">
            <Search />
          </Button>
        )}
      </form>
      <p className="text-xs text-muted-foreground">{user ? fmtUser(user) : ""}</p>
    </div>
  )
}
