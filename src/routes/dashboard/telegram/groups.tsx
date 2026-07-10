import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Eye, EyeOff, MessageCircleMore } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { Pagination } from "@/components/pagination"
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
    <div className="data-page reveal">
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
      {mutationError && <div className="connection-note">{mutationError}</div>}
      {filtered.length ? (
        <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Telegram ID</th>
                  <th>Tag</th>
                  <th>Visibility</th>
                  <th>Invite</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group) => {
                  const link = group.link ?? group.inviteLink
                  const pending = updatingId === group.telegramId
                  return (
                    <tr key={group.telegramId}>
                      <td>
                        <div className="identity">
                          <span className="mini-avatar group">
                            <MessageCircleMore size={15} />
                          </span>
                          <b>{group.title}</b>
                        </div>
                      </td>
                      <td className="mono">{group.telegramId}</td>
                      <td>
                        {group.tag ? <span className="tag">@{group.tag}</span> : <span className="muted">—</span>}
                      </td>
                      <td>
                        <button
                          className={`status-pill visibility-toggle ${group.hide ? "quiet" : ""}`}
                          disabled={pending}
                          onClick={() => void toggleVisibility(group)}
                          title="Toggle group visibility"
                        >
                          {group.hide ? (
                            <>
                              <EyeOff size={12} /> Hidden
                            </>
                          ) : (
                            <>
                              <Eye size={12} /> Visible
                            </>
                          )}
                        </button>
                      </td>
                      <td>
                        {link ? (
                          <a className="table-link" href={link} target="_blank" rel="noreferrer">
                            Open link
                          </a>
                        ) : (
                          <span className="muted">Not shared</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
