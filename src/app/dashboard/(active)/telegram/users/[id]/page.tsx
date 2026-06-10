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
  const data = await getUserDetails(parseInt(id, 10))

  return (
    <div className="container">
      {data && (
        <>
          <div className="grid grid-cols-3 items-start gap-4">
            <UserInfoCard user={data.user} roles={data.roles ?? []} />
            {data.grant && <UserGrantCard user={data.user} grant={data.grant} />}
          </div>

          <div className="pt-6 flex gap-4 items-center">
            <p>Admin in groups:</p>
            <NewGroupAdmin user={data.user} alreadyIn={data.groupAdmin.map((g) => g?.group.id ?? 0) ?? []} />
          </div>
          <div className="grid grid-cols-4 py-2 gap-4">
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
