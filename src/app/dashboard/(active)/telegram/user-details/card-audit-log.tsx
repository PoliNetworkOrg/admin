import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fmtUser } from "@/lib/utils/telegram"
import type { searchUser } from "@/server/actions/get-user"

type Data = Awaited<ReturnType<typeof searchUser>>
type Log = NonNullable<Data>["audits"][number]

export function AuditLogCard({ log: m }: { log: Log }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.type}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-[auto_1fr] gap-x-2">
        <span className="text-muted-foreground">Chat: </span>
        <p>
          {m.groupTitle && <span>{m.groupTitle}</span>} [{m.groupId}]
        </p>
        <span className="text-muted-foreground">Admin ID: </span>
        <p>{m.admin?.user && fmtUser(m.admin.user)}</p>

        {m.createdAt && (
          <>
            <span className="text-muted-foreground">Created: </span>
            <p>{m.createdAt.toLocaleString()}</p>
          </>
        )}

        {m.until && (
          <>
            <span className="text-muted-foreground">Until: </span>
            <p>{m.until.toLocaleString()}</p>
          </>
        )}
        <span className="text-muted-foreground">Reason:</span>
        {m.reason ? <p>{m.reason}</p> : <p className="text-muted-foreground">N/A</p>}
      </CardContent>
    </Card>
  )
}
