import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/lib/auth"
import type { ApiOutput } from "@/server/trpc/types"
import { AddRole } from "./add-role"
import { RemoveRole } from "./remove-role"

type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]
type UserRoles = ApiOutput["tg"]["permissions"]["getRoles"]["roles"]

export function UserInfoCard({
  user,
  roles,
  onUpdate,
}: {
  user: NonNullable<User>
  roles: UserRoles
  onUpdate(): void
}) {
  const sesh = useSession()
  const seshUserId = sesh.data?.user.telegramId
  const isSelf = seshUserId && seshUserId === user.id

  return (
    <Card className="w-fit min-w-120">
      <CardHeader>
        <CardTitle>
          # User ID: {user.id}{" "}
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
        <AddRole alreadyRoles={roles ?? []} user={user} onAdd={onUpdate} />
        <RemoveRole alreadyRoles={roles ?? []} user={user} onDelete={onUpdate} />
      </CardFooter>
    </Card>
  )
}
