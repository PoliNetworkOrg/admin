import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"
import { fmtUser } from "@/lib/utils/telegram"

type Log = NonNullable<ApiOutput["tg"]["auditLog"]["getById"]>[number]
export function AuditLogCard({ log: m }: { log: Log }) {
  const trpc = useTRPC()

  const { data: admin } = useQuery(trpc.tg.users.get.queryOptions({ userId: m.adminId }))

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
        <p>{admin?.user && fmtUser(admin.user)}</p>

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
