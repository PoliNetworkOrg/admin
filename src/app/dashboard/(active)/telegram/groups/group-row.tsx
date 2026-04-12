"use client"
import { Copy, Pen } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { setGroupHide } from "@/server/actions/groups"
import type { TgGroup } from "@/server/trpc/types"

export function GroupRow({ row: r }: { row: TgGroup }) {
  const router = useRouter()

  async function toggleHide() {
    const ok = await setGroupHide(r.telegramId, !r.hide).catch(() => false)
    if (!ok) toast.error("The field cannot be modified")

    toast.success("Hide option toggled!")
    router.refresh()
  }

  return (
    <div className="grid gap-4 items-center grid-cols-5 border-b py-2 w-full">
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
            className="hover:underline text-xs"
          >
            {r.link}
          </a>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
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
      <div className="flex items-center justify-start gap-2">
        <p>{r.hide ? <Badge className="bg-yellow-800">HIDDEN</Badge> : <Badge variant="secondary">Visibile</Badge>}</p>
        <Button type="button" variant="outline" size="icon-sm" className={!r.link ? "hidden" : ""} onClick={toggleHide}>
          <Pen />
        </Button>
      </div>
    </div>
  )
}
