"use client"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"
import { DeleteGrant } from "./delete-grant"

type Grants = NonNullable<ApiOutput["tg"]["grants"]["getOngoing"]["grants"]>

export function GrantList() {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.tg.grants.getOngoing.queryOptions())

  return (
    <div className="flex flex-col w-full items-start justify-start py-4">
      <div className="grid gap-4 items-center grid-cols-5 w-full border-b py-2 font-bold">
        <p>Telegram ID</p>
        <p>Username</p>
        <p>Start Date</p>
        <p>End Date</p>
        <p>Interrupt</p>
      </div>
      {data?.grants?.map((r) => (
        <GrantRow row={r} key={r.grant.id} />
      ))}
      {data?.grants.length === 0 && <div className="w-full text-center py-2 italic">There are no ongoing grants</div>}
    </div>
  )
}

function GrantRow({ row: r }: { row: Grants[number] }) {
  return (
    <div className="grid gap-4 items-center grid-cols-5 border-b py-2 w-full">
      <p>{r.grant.userId}</p>
      <p className={r.user?.username ? "" : "text-muted-foreground italic"}>
        {r.user?.username ? `@${r.user.username}` : `<unset>`}
      </p>
      <p>{format(r.grant.validSince, "yyyy/MM/dd HH:mm")}</p>
      <p>{format(r.grant.validUntil, "yyyy/MM/dd HH:mm")}</p>
      <DeleteGrant userId={r.grant.userId} />
    </div>
  )
}
