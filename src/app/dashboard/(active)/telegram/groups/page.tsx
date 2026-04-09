"use client"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Copy, Search, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"

type Groups = ApiOutput["tg"]["groups"]["search"]["groups"]

export default function TgGroups() {
  const [query, setQuery] = useState("")

  const trpc = useTRPC()
  const qc = useQueryClient()
  const queryOpts = trpc.tg.groups.search.queryOptions({ query, limit: 20 })

  const [rows, setRows] = useState<Groups>([])
  async function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const res = await qc.fetchQuery(queryOpts)
    setRows(res.groups)
    if (res.count === 0) toast.warning("No groups found with this query")
    else toast.info(`Found ${res.count} groups`)
  }

  function reset() {
    setRows([])
    setQuery("")
  }

  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <form onSubmit={search} className="pt-2 gap-y-4 flex flex-col justify-start items-start">
        <div className="flex gap-2 flex-col items-start justify-start">
          <Label htmlFor="email" className="text-base">
            Search
          </Label>
          <div className="flex gap-2 items-center justify-start">
            <Input
              id="group-query"
              type="text"
              placeholder="Group name"
              className="bg-card w-auto"
              required
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              value={query}
            />
            <Button type="submit" size="icon">
              <Search />
            </Button>
            {rows.length > 0 && (
              <Button variant="outline" onClick={reset}>
                <X />
                Reset
              </Button>
            )}
          </div>
          <span className="text-muted-foreground text-xs">Max results: 20</span>
        </div>
      </form>
      <div className="flex flex-col w-full items-start justify-start py-4">
        <div className="grid gap-4 items-center grid-cols-4 w-full border-b py-2">
          <p>telegram ID</p>
          <p>Title</p>
          <p>Tag</p>
          <p>Invite Link</p>
        </div>
        {rows.map((r) => (
          <GroupRow row={r} key={r.telegramId} />
        ))}
      </div>
    </div>
  )
}

function GroupRow({ row: r }: { row: Groups[number] }) {
  return (
    <div className="grid gap-4 items-center grid-cols-4 border-b py-2 w-full">
      <p>{r.telegramId}</p>
      <p>{r.title}</p>
      <p className={r.tag ? "" : "text-muted-foreground italic"}>{r.tag ? `@${r.tag}` : `<unset>`}</p>
      <div className="flex items-center justify-start gap-2">
        {r.link && (
          <a
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Link for group ${r.title}`}
            className="hover:underline"
          >
            {r.link}
          </a>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={!r.link ? "hidden" : ""}
          onClick={async () => {
            try {
              if (!r.link) return
              await navigator.clipboard.writeText(r.link)
              toast.success("Link copied to clipboard!")
            } catch (err) {
              toast.error("Cannot copy link to clipboard")
              console.error(err)
            }
          }}
        >
          <Copy />
        </Button>
      </div>
    </div>
  )
}
