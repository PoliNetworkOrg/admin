import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Eye, EyeOff, MessageCircleMore } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { Pagination } from "@/components/pagination"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { getTelegramGroups, setGroupVisibility } from "@/server/api.functions"

const PAGE_SIZE = 20

type TelegramGroup = {
  telegramId: number
  title: string
  tag?: string | null
  link?: string | null
  inviteLink?: string | null
  hide?: boolean | null
}

export const Route = createFileRoute("/dashboard/telegram/groups")({
  loader: () => getTelegramGroups(),
  component: TelegramGroups,
})

function TelegramGroups() {
  const response = Route.useLoaderData()
  const router = useRouter()
  const loadedGroups = response.data as TelegramGroup[]
  const [groups, setGroups] = useState(loadedGroups)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [mutationError, setMutationError] = useState("")

  useEffect(() => setGroups(loadedGroups), [loadedGroups])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase().replace(/^@/, "")
    return groups
      .filter(
        (group) => !normalized || `${group.title}\u0000${group.tag ?? ""}`.toLocaleLowerCase().includes(normalized)
      )
      .toSorted((a, b) => a.title.localeCompare(b.title))
  }, [groups, query])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleGroups = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount])

  async function toggleVisibility(group: TelegramGroup) {
    if (updatingId !== null) return
    const hide = !group.hide
    setUpdatingId(group.telegramId)
    setMutationError("")
    setGroups((current) => current.map((item) => (item.telegramId === group.telegramId ? { ...item, hide } : item)))

    try {
      await setGroupVisibility({ data: { telegramId: group.telegramId, hide } })
      await router.invalidate()
    } catch {
      setGroups((current) => current.map((item) => (item.telegramId === group.telegramId ? group : item)))
      setMutationError("The visibility setting could not be updated. Check your permissions and try again.")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        title="Telegram groups"
        description="Maintain the community groups connected to PoliNetwork."
        count={filtered.length}
        onSearch={(value) => {
          setQuery(value)
          setPage(1)
        }}
      />
      <LiveStatus connected={response.connected} message={response.message} />
      {mutationError && (
        <Alert className="mb-4 rounded-none border-l-[3px] border-l-[#d86b3f] bg-[#fff4e8] px-3 py-2.5 text-[11px] text-[#895322]">
          <AlertDescription className="text-[11px] leading-[1.45] text-[#895322]">{mutationError}</AlertDescription>
        </Alert>
      )}
      {filtered.length ? (
        <>
          <div className="overflow-auto border border-border bg-card">
            <Table className="min-w-[700px] text-left">
              <TableHeader>
                <tr>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Group
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Telegram ID
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Tag
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Visibility
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Invite
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {visibleGroups.map((group) => {
                  const link = group.link ?? group.inviteLink
                  const pending = updatingId === group.telegramId
                  return (
                    <TableRow key={group.telegramId} className="hover:bg-[#f6f9fe]">
                      <TableCell className="px-[15px] py-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#e9e8df] text-primary">
                            <MessageCircleMore className="size-4" />
                          </span>
                          <b>{group.title}</b>
                        </div>
                      </TableCell>
                      <TableCell className="px-[15px] py-3 font-mono text-[10px] text-[#51647f]">
                        {group.telegramId}
                      </TableCell>
                      <TableCell className="px-[15px] py-3">
                        {group.tag ? (
                          <Badge className="h-5 rounded-none bg-accent px-1.5 font-mono text-[9px] text-primary">
                            @{group.tag}
                          </Badge>
                        ) : (
                          <span className="text-[11px] italic text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-[15px] py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-6 rounded-none border-transparent px-1.5 font-mono text-[9px]",
                            group.hide ? "bg-muted text-muted-foreground" : "bg-[#e5effc] text-primary"
                          )}
                          disabled={pending}
                          onClick={() => void toggleVisibility(group)}
                          title="Toggle group visibility"
                        >
                          {group.hide ? (
                            <>
                              <EyeOff data-icon="inline-start" /> Hidden
                            </>
                          ) : (
                            <>
                              <Eye data-icon="inline-start" /> Visible
                            </>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="px-[15px] py-3">
                        {link ? (
                          <a
                            className="font-mono text-[11px] font-medium text-primary hover:underline"
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open link
                          </a>
                        ) : (
                          <span className="text-[11px] italic text-muted-foreground">Not shared</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={MessageCircleMore}
          title="No matching groups"
          text="Try another filter or check the backend connection."
        />
      )}
    </div>
  )
}
