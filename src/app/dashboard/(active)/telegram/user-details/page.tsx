"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, RefreshCcw, Search, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"
import { AuditLogCard } from "./card-audit-log"
import { GroupAdminCard } from "./card-group-admin"
import { MessageCard } from "./card-message"
import { UserGrantCard } from "./card-user-grant"
import { UserInfoCard } from "./card-user-info"
import { NewGroupAdmin } from "./new-group-admin"

type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]

export default function TgUsers() {
  const [query, setQuery] = useState("")
  const [user, setUser] = useState<User>(null)

  const trpc = useTRPC()

  const qc = useQueryClient()
  const searchQuery = trpc.tg.users.getByUsername.queryOptions({ username: query })
  const { data: userData, refetch: refetch1 } = useQuery(
    trpc.tg.permissions.getRoles.queryOptions({ userId: user?.id ?? 0 })
  )
  const { data: messages, refetch: refetch2 } = useQuery(
    trpc.tg.messages.getLastByUser.queryOptions({ userId: user?.id ?? 0 })
  )
  const { data: auditLog, refetch: refetch3 } = useQuery(
    trpc.tg.auditLog.getById.queryOptions({ targetId: user?.id ?? 0 })
  )

  async function refetch() {
    await Promise.all([refetch1(), refetch2(), refetch3])
    toast.success("Reloaded correctly")
  }

  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const res = await qc.fetchQuery(searchQuery)
    if (!res.user) {
      setUser(null)
      return toast.warning("No user found with this username")
    }
    setUser(res.user)
  }

  function reset() {
    setUser(null)
    setQuery("")
  }

  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>

      <form onSubmit={search} className="pt-2 gap-y-4 flex flex-col justify-start items-start">
        <div className="flex gap-2 flex-col items-start justify-start">
          <Label htmlFor="email" className="text-base">
            Search by username
          </Label>
          <div className="flex gap-2 items-center justify-start">
            <Input
              id="group-query"
              type="text"
              placeholder="Username"
              className="bg-card w-auto"
              required
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              value={query}
            />
            <Button type="submit" size="icon">
              <Search />
            </Button>
            {user && (
              <Button variant="outline" onClick={reset}>
                <X />
                Reset
              </Button>
            )}
            {user && (
              <Button variant="secondary" onClick={refetch}>
                <RefreshCcw />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </form>

      <br />

      {user && (
        <>
          <div className="grid grid-cols-3 items-start">
            <UserInfoCard user={user} roles={userData?.roles ?? []} />
            <UserGrantCard user={user} />
          </div>

          <div className="pt-6 flex gap-4 items-center">
            <p>Admin in groups:</p>
            <NewGroupAdmin user={user} alreadyIn={userData?.groupAdmin.map((g) => g?.group.id ?? 0) ?? []} />
          </div>
          <div className="grid grid-cols-4 py-2 gap-4">
            {userData?.groupAdmin
              .filter((m) => m !== null && m !== undefined)
              .map((m) => (
                <GroupAdminCard groupAdminInfo={m} user={user} key={m.group.id} />
              ))}

            {userData?.groupAdmin.length === 0 && (
              <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                This user is not group admin in any group.
              </p>
            )}
          </div>

          <p className="pt-6">Last messages (max 12):</p>
          <div className="grid grid-cols-3 py-2 gap-4">
            {messages?.messages?.map((m) => (
              <MessageCard message={m} key={`${m.chatId}-${m.messageId}`} />
            ))}

            {messages?.messages?.length === 0 && (
              <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                No recent messages sent by this user
              </p>
            )}
          </div>

          <p className="pt-6">Audit log:</p>
          <div className="grid grid-cols-3 py-2 gap-4">
            {auditLog?.map((m) => (
              <AuditLogCard log={m} key={`${m.id}-${m.type}`} />
            ))}
            {auditLog?.length === 0 && (
              <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                No audit log found for this user
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
