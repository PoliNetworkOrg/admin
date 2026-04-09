"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ExternalLinkIcon, Search, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"
import { stripChatId } from "@/lib/utils/telegram"
import { DeleteGroupAdmin } from "./delete-group-admin"
import { NewGroupAdmin } from "./new-group-admin"

type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]

export default function TgUsers() {
  const [query, setQuery] = useState("")
  const [user, setUser] = useState<User>(null)

  const trpc = useTRPC()

  const qc = useQueryClient()
  const searchQuery = trpc.tg.users.getByUsername.queryOptions({ username: query })
  const { data: userData } = useQuery(trpc.tg.permissions.getRoles.queryOptions({ userId: user?.id ?? 0 }))
  const { data: messages } = useQuery(trpc.tg.messages.getLastByUser.queryOptions({ userId: user?.id ?? 0 }))

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
          </div>
          <span className="text-muted-foreground text-xs">Max results: 20</span>
        </div>
      </form>

      <br />

      {user && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>User ID: {user.id}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                <span className="text-muted-foreground">Name: </span>
                {user.firstName} {user.lastName}
              </p>
              <p>
                <span className="text-muted-foreground">Username: </span>
                {user.username}
              </p>
              <p>
                <span className="text-muted-foreground">Roles: </span>
                {userData?.roles ? userData.roles.join(", ") : 0}
              </p>
            </CardContent>
          </Card>

          <div className="pt-6 flex gap-4 items-center">
            <p>Admin in groups:</p>
            <NewGroupAdmin user={user} alreadyIn={userData?.groupAdmin.map((g) => g?.group.id ?? 0) ?? []} />
          </div>
          <div className="grid grid-cols-3 py-2 gap-4">
            {userData?.groupAdmin.map(
              (m, idx) =>
                m && (
                  <Card key={m.group.id ?? `ga-${idx}`}>
                    <CardContent>
                      <p>
                        {" "}
                        <span className="text-muted-foreground">Chat: </span>
                        {m.group && <span>{m.group.title}</span>} [{m.group.id}]
                      </p>
                      <p>
                        <span className="text-muted-foreground">Added By: </span>
                        {m.addedBy.firstName} {m.addedBy.username ? `@${m.addedBy.username}` : ""}
                      </p>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                      <DeleteGroupAdmin userId={user.id} chatId={m.group.id} />
                    </CardFooter>
                  </Card>
                )
            )}
          </div>

          <p className="pt-6">Last messages:</p>
          <div className="grid grid-cols-3 py-2 gap-4">
            {messages?.messages?.map((m) => (
              <Card key={`${m.messageId}-${m.chatId}`}>
                <CardContent>
                  <p>
                    {" "}
                    <span className="text-muted-foreground">Chat: </span>
                    {m.group && <span>{m.group.title}</span>} [{m.chatId}]
                  </p>
                  <p>
                    {" "}
                    <span className="text-muted-foreground">Message ID: </span>
                    {m.messageId}
                  </p>
                  <p>
                    {" "}
                    <span className="text-muted-foreground">Timestamp: </span>
                    {m.timestamp.toLocaleString()}
                  </p>
                  <span className="text-muted-foreground">Content:</span>
                  <p className="pl-3">{m.message}</p>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  {m.group?.inviteLink && (
                    <a href={m.group.inviteLink} rel="noopener noreferral" target="_blank" aria-label="Join group">
                      <Button variant="outline">
                        <ExternalLinkIcon size={20} /> Join Chat
                      </Button>
                    </a>
                  )}
                  <a
                    href={`https://t.me/c/${stripChatId(m.chatId)}/${m.messageId}`}
                    rel="noopener noreferral"
                    target="_blank"
                    aria-label="Open message in chat"
                  >
                    <Button variant="outline">
                      <ExternalLinkIcon size={20} /> Open
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
