import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getUserDetails } from "@/server/actions/users"
import { AuditLogCard } from "./card-audit-log"
import { GroupAdminCard } from "./card-group-admin"
import { MessageCard } from "./card-message"
import { UserGrantCard } from "./card-user-grant"
import { UserInfoCard } from "./card-user-info"
import { NewGroupAdmin } from "./new-group-admin"

export default async function TgUserDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsedInt = parseInt(id, 10)
  if (Number.isNaN(parsedInt)) notFound()
  const data = await getUserDetails(parsedInt)

  if (!data) notFound()

  return (
    <div className="container">
      {data && (
        <>
          <div className="grid grid-cols-3 items-start gap-4 w-full">
            <UserInfoCard user={data.user} roles={data.roles ?? []} />
            {data.grant && <UserGrantCard user={data.user} grant={data.grant} />}
          </div>

          <div className="w-full">
            <div className="flex gap-4 items-center w-full">
              <p>Admin in groups:</p>
              <NewGroupAdmin user={data.user} alreadyIn={data.groupAdmin.map((g) => g?.group.id ?? 0) ?? []} />
            </div>

            <div className="grid grid-cols-4 py-3 gap-4 w-full">
              {data.groupAdmin
                .filter((m) => m !== null && m !== undefined)
                .map((m) => (
                  <GroupAdminCard groupAdminInfo={m} user={data.user} key={m.group.id} />
                ))}

              {data.groupAdmin.length === 0 && (
                <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                  This user is not group admin in any group.
                </p>
              )}
            </div>
          </div>

          <div className="w-full">
            <p>Last messages (max 15):</p>
            <div className="grid grid-cols-3 py-3 gap-4 w-full">
              {data.messages?.map((m) => (
                <MessageCard message={m} key={`${m.chatId}-${m.messageId}`} />
              ))}

              {data.messages?.length === 0 && (
                <p className="bg-card rounded-lg p-3 italic text-muted-foreground text-sm">
                  No recent messages sent by this user
                </p>
              )}
            </div>
          </div>

          <div className="w-full">
            <p>Audit log:</p>
            <div className="grid grid-cols-3 py-3 gap-4 w-full">
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
          </div>
        </>
      )}
    </div>
  )
}
