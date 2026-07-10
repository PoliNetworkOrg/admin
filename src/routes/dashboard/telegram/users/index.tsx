import { createFileRoute, Link } from "@tanstack/react-router"
import { Eye, MessageCircle } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { Pagination } from "@/components/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getTelegramUsers } from "@/server/api.functions"

const PAGE_SIZE = 25

type TelegramUser = {
  id: number
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  profilePicUrl?: string | null
}

export const Route = createFileRoute("/dashboard/telegram/users/")({
  loader: () => getTelegramUsers(),
  component: TelegramUsers,
})

function TelegramUsers() {
  const response = Route.useLoaderData()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase().replace(/^@/, ""))
  const users = (response.data as { users?: TelegramUser[] }).users ?? []

  const searchIndex = useMemo(
    () =>
      users.map((user) => ({
        user,
        searchable:
          `${user.username ?? ""}\u0000${user.firstName ?? ""}\u0000${user.lastName ?? ""}`.toLocaleLowerCase(),
      })),
    [users]
  )

  const filtered = useMemo(
    () => (deferredQuery ? searchIndex.filter(({ searchable }) => searchable.includes(deferredQuery)) : searchIndex),
    [deferredQuery, searchIndex]
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount])

  return (
    <div className="animate-appear">
      <DataToolbar
        title="Telegram users"
        description="Browse members known to the PoliNetwork Telegram ecosystem."
        count={filtered.length}
        onSearch={(value) => {
          setQuery(value)
          setPage(1)
        }}
      />
      <LiveStatus connected={response.connected} message={response.message} />
      {filtered.length ? (
        <>
          <div className="overflow-auto border border-border bg-card">
            <Table className="min-w-[700px] text-left">
              <TableHeader>
                <tr>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Telegram ID
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Identity
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                    Username
                  </TableHead>
                  <TableHead className="h-[39px] bg-[#efeee7] px-[15px]" aria-label="Actions" />
                </tr>
              </TableHeader>
              <TableBody>
                {visibleUsers.map(({ user }) => (
                  <TableRow key={user.id} className="hover:bg-[#f6f9fe]">
                    <TableCell className="px-[15px] py-3 font-mono text-[10px] text-[#51647f]">{user.id}</TableCell>
                    <TableCell className="px-[15px] py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-accent font-mono text-[10px] font-medium text-primary">
                          {(user.firstName?.[0] ?? user.username?.[0] ?? "?").toUpperCase()}
                        </span>
                        <span>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-[15px] py-3">
                      {user.username ? (
                        <span className="font-mono text-[11px] font-medium text-primary">@{user.username}</span>
                      ) : (
                        <span className="text-[11px] italic text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="px-[15px] py-3">
                      <Link
                        to="/dashboard/telegram/users/$userId"
                        params={{ userId: String(user.id) }}
                        className="grid size-7 place-items-center bg-accent text-primary transition-colors hover:bg-[#dce9fa]"
                        aria-label={`Open ${user.username ?? user.id}`}
                      >
                        <Eye />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState
          icon={MessageCircle}
          title="No matching Telegram users"
          text="Try another filter or check the backend connection."
        />
      )}
    </div>
  )
}
