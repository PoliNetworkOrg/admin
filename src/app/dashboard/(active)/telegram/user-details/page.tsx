"use client"
import { ArrowLeft, RefreshCcw, Search, X } from "lucide-react"
import Link from "next/link"
import { Suspense, startTransition, useActionState, useState } from "react"
import { start } from "repl"
import { Spinner } from "@/components/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { searchUser } from "@/server/actions/users"
import { AuditLogCard } from "./card-audit-log"
import { GroupAdminCard } from "./card-group-admin"
import { MessageCard } from "./card-message"
import { UserGrantCard } from "./card-user-grant"
import { UserInfoCard } from "./card-user-info"
import { NewGroupAdmin } from "./new-group-admin"

type Data = Awaited<ReturnType<typeof searchUser>>

export default function TgUsers() {
  const [username, setUsername] = useState("")
  const [data, action, pending] = useActionState<Data | null>(() => (username ? searchUser(username) : null), null)

  function reset() {
    setUsername("")
    action()
  }

  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>

      <form action={action} className="pt-2 gap-y-4 flex flex-col justify-start items-start">
        <div className="flex gap-2 flex-col items-start justify-start">
          <Label htmlFor="email" className="text-base">
            Search by username
          </Label>
          <div className="flex gap-2 items-center justify-start">
            <Input
              id="group-query"
              type="text"
              placeholder="Username"
              disabled={!!data}
              className="bg-card w-auto"
              required
              onChange={(e) => {
                setUsername(e.target.value)
              }}
              value={username}
            />

            {data ? (
              <Button variant="outline" onClick={() => startTransition(reset)}>
                <X />
                Reset
              </Button>
            ) : (
              <Button disabled={pending} type="submit" size="icon" className={pending ? "bg-muted" : ""}>
                {pending ? <Spinner /> : <Search />}
              </Button>
            )}
            {data && (
              <Button disabled={pending} variant="secondary" type="submit">
                <RefreshCcw />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </form>

      <br />

      {data && (
        <>
          <div className="grid grid-cols-3 items-start">
            <UserInfoCard user={data.user} roles={data.roles ?? []} onUpdate={() => startTransition(action)} />
            <UserGrantCard user={data.user} />
          </div>

          <div className="pt-6 flex gap-4 items-center">
            <p>Admin in groups:</p>
            <NewGroupAdmin
              user={data.user}
              alreadyIn={data.groupAdmin.map((g) => g?.group.id ?? 0) ?? []}
              onConfirm={() => startTransition(action)}
            />
          </div>
          <div className="grid grid-cols-4 py-2 gap-4">
            {data.groupAdmin
              .filter((m) => m !== null && m !== undefined)
              .map((m) => (
                <GroupAdminCard
                  groupAdminInfo={m}
                  user={data.user}
                  key={m.group.id}
                  onDelete={() => startTransition(action)}
                />
              ))}

            {data.groupAdmin.length === 0 && (
              <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                This user is not group admin in any group.
              </p>
            )}
          </div>

          <p className="pt-6">Last messages (max 12):</p>
          <div className="grid grid-cols-3 py-2 gap-4">
            {data.messages?.map((m) => (
              <MessageCard message={m} key={`${m.chatId}-${m.messageId}`} />
            ))}

            {data.messages?.length === 0 && (
              <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                No recent messages sent by this user
              </p>
            )}
          </div>

          <p className="pt-6">Audit log:</p>
          <div className="grid grid-cols-3 py-2 gap-4">
            {data.audits.map((m) => (
              <Suspense fallback={null} key={`${m.id}-${m.type}`}>
                <AuditLogCard log={m} />
              </Suspense>
            ))}
            {data.audits.length === 0 && (
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
