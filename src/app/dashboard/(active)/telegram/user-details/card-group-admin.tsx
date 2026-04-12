import { Code } from "@/components/code"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { ApiOutput } from "@/lib/trpc/types"
import { stripChatId } from "@/lib/utils/telegram"
import { DeleteGroupAdmin } from "./delete-group-admin"

type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]
type GroupAdminSingle = NonNullable<ApiOutput["tg"]["permissions"]["getRoles"]["groupAdmin"][number]>

export function GroupAdminCard({
  user,
  groupAdminInfo: m,
}: {
  user: NonNullable<User>
  groupAdminInfo: GroupAdminSingle
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.group.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>
          <span className="text-muted-foreground">Chat ID: </span>
          <Code copyOnClick>{m.group.id}</Code> / <Code copyOnClick>{stripChatId(m.group.id)}</Code>
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
