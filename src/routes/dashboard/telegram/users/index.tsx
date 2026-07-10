import { createFileRoute, Link } from "@tanstack/react-router"
import { Eye, MessageCircle } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { Pagination } from "@/components/pagination"
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
    <div className="data-page reveal">
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
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Telegram ID</th>
                  <th>Identity</th>
                  <th>Username</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map(({ user }) => (
                  <tr key={user.id}>
                    <td className="mono">{user.id}</td>
                    <td>
                      <div className="identity">
                        <span className="mini-avatar">
                          {(user.firstName?.[0] ?? user.username?.[0] ?? "?").toUpperCase()}
                        </span>
                        <span>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"}</span>
                      </div>
                    </td>
                    <td>
                      {user.username ? (
                        <span className="handle">@{user.username}</span>
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to="/dashboard/telegram/users/$userId"
                        params={{ userId: String(user.id) }}
                        className="row-action"
                        aria-label={`Open ${user.username ?? user.id}`}
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
