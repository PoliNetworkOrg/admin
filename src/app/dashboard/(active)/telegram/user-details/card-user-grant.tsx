"use client"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Sparkle, Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useTRPC } from "@/lib/trpc/client"
import type { TgUser } from "@/lib/trpc/types"
import { DeleteGrant } from "../grants/delete-grant"

export function UserGrantCard({ user }: { user: TgUser }) {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.tg.grants.checkUser.queryOptions({ userId: user.id }))

  if (!data) return null
  return (
    data.grant && (
      <Card className="w-fit min-w-120">
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Sparkle size={20} /> Ongoing Grant
          </CardTitle>
          <CardDescription>This user has an ongoing grant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>Start: {format(data.grant.validSince, "yyyy/MM/dd HH:mm")}</p>
          <p>End: {format(data.grant.validUntil, "yyyy/MM/dd HH:mm")}</p>
        </CardContent>
        <CardFooter className="gap-2">
          <DeleteGrant userId={user.id} />
        </CardFooter>
      </Card>
    )
  )
}
