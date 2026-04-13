"use server"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { trpc } from "@/server/trpc"
import { GroupRow } from "./group-row"
import { SearchInput } from "./search-input"

export default async function TgGroups({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams

  const all = await trpc.tg.groups.getAll.query()
  const rows = q ? (await trpc.tg.groups.search.query({ limit: 20, query: q, showHidden: true })).groups : all

  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <SearchInput />
      <p className="pt-4 text-sm text-muted-foreground">
        Count: <span className="text-foreground">{rows.length}</span>
      </p>
      <div className="flex flex-col w-full items-start justify-start py-4">
        <div className="grid gap-4 items-center grid-cols-5 w-full border-b py-2">
          <p>telegram ID</p>
          <p>Title</p>
          <p>Tag</p>
          <p>Invite Link</p>
          <p>Hide</p>
        </div>
        {rows.map((r) => (
          <GroupRow row={r} key={r.telegramId} />
        ))}
      </div>
    </div>
  )
}
