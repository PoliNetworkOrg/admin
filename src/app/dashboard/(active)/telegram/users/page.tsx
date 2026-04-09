"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ExternalLinkIcon, Search, Star, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSession } from "@/lib/auth"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"
import { fmtUser, stripChatId } from "@/lib/utils/telegram"
import { AddRole } from "./add-role"
import { DeleteGroupAdmin } from "./delete-group-admin"
import { NewGroupAdmin } from "./new-group-admin"
import { RemoveRole } from "./remove-role"

type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]

export default function TgUsers() {
  const [query, setQuery] = useState("")
  const [user, setUser] = useState<User>(null)

  const trpc = useTRPC()

  const qc = useQueryClient()
  const searchQuery = trpc.tg.users.getByUsername.queryOptions({ username: query })
  const { data: userData } = useQuery(trpc.tg.permissions.getRoles.queryOptions({ userId: user?.id ?? 0 }))
  const { data: messages } = useQuery(trpc.tg.messages.getLastByUser.queryOptions({ userId: user?.id ?? 0 }))
  const { data: auditLog } = useQuery(trpc.tg.auditLog.getById.queryOptions({ targetId: user?.id ?? 0 }))

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
        </div>
      </form>

      <br />

      {user && (
        <>
          <UserInfoCard user={user} roles={userData?.roles ?? []} />
          <div className="pt-6 flex gap-4 items-center">
            <p>Admin in groups:</p>
            <NewGroupAdmin user={user} alreadyIn={userData?.groupAdmin.map((g) => g?.group.id ?? 0) ?? []} />
          </div>
          <div className="grid grid-cols-3 py-2 gap-4">
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

          <p className="pt-6">Last messages:</p>
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

type UserRoles = ApiOutput["tg"]["permissions"]["getRoles"]["roles"]
function UserInfoCard({ user, roles }: { user: NonNullable<User>; roles: UserRoles }) {
  const sesh = useSession()
  const seshUserId = sesh.data?.user.telegramId
  const isSelf = seshUserId && seshUserId === user.id

  return (
    <Card className="w-fit min-w-120">
      <CardHeader>
        <CardTitle>
          User ID: {user.id}{" "}
          {isSelf && (
            <Badge>
              <Star /> You
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          <span className="text-muted-foreground">Name: </span>
          {user.firstName} {user.lastName ?? ""}
        </p>
        <p>
          <span className="text-muted-foreground">Username: </span>
          {user.username}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Roles: </span>
          {roles ? roles.map((r) => <Badge key={r}>{r}</Badge>) : "N/A"}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <AddRole alreadyRoles={roles ?? []} user={user} />
        <RemoveRole alreadyRoles={roles ?? []} user={user} />
      </CardFooter>
    </Card>
  )
}

type GroupAdminSingle = NonNullable<ApiOutput["tg"]["permissions"]["getRoles"]["groupAdmin"][number]>
function GroupAdminCard({ user, groupAdminInfo: m }: { user: NonNullable<User>; groupAdminInfo: GroupAdminSingle }) {
  return (
    <Card>
      <CardContent className="space-y-2">
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
}

type Message = NonNullable<ApiOutput["tg"]["messages"]["getLastByUser"]["messages"]>[number]
function MessageCard({ message: m }: { message: Message }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p>
          <span className="text-muted-foreground">Chat: </span>
          {m.group && <span>{m.group.title}</span>} [{m.chatId}]
        </p>
        <p>
          <span className="text-muted-foreground">Message ID: </span>
          {m.messageId}
        </p>
        <p>
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
  )
}

type Log = NonNullable<ApiOutput["tg"]["auditLog"]["getById"]>[number]
function AuditLogCard({ log: m }: { log: Log }) {
  const trpc = useTRPC()

  const { data: admin } = useQuery(trpc.tg.users.get.queryOptions({ userId: m.adminId }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.type}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          {" "}
          <span className="text-muted-foreground">Chat: </span>
          {m.groupTitle && <span>{m.groupTitle}</span>} [{m.groupId}]
        </p>
        <p>
          {" "}
          <span className="text-muted-foreground">Admin ID: </span>
          {admin && admin.user && fmtUser(admin.user)}
        </p>
        {m.createdAt && (
          <p>
            <span className="text-muted-foreground">Created: </span>
            {m.createdAt.toLocaleString()}
          </p>
        )}
        {m.until && (
          <p>
            <span className="text-muted-foreground">Until: </span>
            {m.until.toLocaleString()}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Reason:</span>
          {m.reason}
        </p>
      </CardContent>
    </Card>
  )
}
