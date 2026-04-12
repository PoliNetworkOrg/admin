"use client"
import { format } from "date-fns"
import { Sparkle } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { TgGrant, TgUser } from "@/server/trpc/types"
import { DeleteGrant } from "../grants/delete-grant"

export function UserGrantCard({ user, grant, onDelete }: { user: TgUser; grant: TgGrant; onDelete(): void }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex gap-2 items-center">
          <Sparkle size={20} /> Ongoing Grant
        </CardTitle>
        <CardDescription>This user has an ongoing grant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 grow">
        <p>Start: {format(grant.validSince, "yyyy/MM/dd HH:mm")}</p>
        <p>End: {format(grant.validUntil, "yyyy/MM/dd HH:mm")}</p>
      </CardContent>
      <CardFooter className="gap-2">
        <DeleteGrant userId={user.id} onDelete={onDelete} />
      </CardFooter>
    </Card>
  )
}
