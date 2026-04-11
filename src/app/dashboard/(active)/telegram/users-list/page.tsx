"use client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Copy, Pen, Search, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"

type Users = NonNullable<ApiOutput["tg"]["users"]["getAll"]["users"]>

export default function TgGroups() {
  const [query, setQuery] = useState("")

  const trpc = useTRPC()
  const qc = useQueryClient()

  const { data } = useQuery(trpc.tg.users.getAll.queryOptions())

  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="flex flex-col w-full items-start justify-start py-4">
        <div className="grid gap-4 items-center grid-cols-3 w-full border-b py-2 font-bold">
          <p>Telegram ID</p>
          <p>Username</p>
          <p>Name</p>
        </div>
        {data?.users?.map((r) => (
          <UserRow row={r} key={r.id} />
        ))}
      </div>
    </div>
  )
}

function UserRow({ row: r }: { row: Users[number] }) {
  return (
    <div className="grid gap-4 items-center grid-cols-3 border-b py-2 w-full">
      <p>{r.id}</p>
      <p className={r.username ? "" : "text-muted-foreground italic"}>{r.username ? `@${r.username}` : `<unset>`}</p>
      <p>
        {r.firstName ?? ""} {r.lastName ?? ""}
      </p>
    </div>
  )
}
