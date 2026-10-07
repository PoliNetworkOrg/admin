import { useNavigate } from "@tanstack/react-router"
import { UsersRound } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { buttonMotion, DataTable, type DataTableColumn, EmptyState, Unset } from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { telegramUserName } from "@/components/telegram/telegram-user"
import { Button } from "@/components/ui/button"
import type { TgUser } from "@/lib/api/types"

function matchesUser(user: TgUser, query: string) {
  if (!query) return true
  const haystack = [user.firstName, user.lastName, user.username].filter(Boolean).join(" ").toLocaleLowerCase()
  return haystack.includes(query)
}

// No roles column: `tg.users.getAll` does not return roles and the backend has no bulk roles query.
const columns: DataTableColumn<TgUser>[] = [
  {
    id: "name",
    label: "Name",
    minWidth: 260,
    cell: (user) => {
      const name = telegramUserName(user)
      return (
        <span className="flex min-w-0 flex-col">
          <span className="truncate" title={name}>
            {name}
          </span>
          <span className="truncate text-xs leading-4 font-normal text-(--pn-fg-muted)">
            {user.username ? `@${user.username}` : <Unset />}
          </span>
        </span>
      )
    },
  },
  {
    id: "telegramId",
    label: "Telegram ID",
    mono: true,
    priority: 1,
    cell: (user) => user.id,
  },
]

const PAGE_SIZE = 20

/** Telegram users (docs/design.md §7.3): searchable list; a row opens the user's detail. */
export function TelegramUsersPage({ users }: { users: TgUser[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const deferredQuery = useDeferredValue(query)

  const normalized = deferredQuery.trim().replace(/^@/, "").toLocaleLowerCase()
  const filtered = useMemo(() => users.filter((user) => matchesUser(user, normalized)), [users, normalized])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const searching = normalized !== ""

  function updateQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: query, onChange: updateQuery, placeholder: "Search by name or username…" }}
            count={<Count value={filtered.length} total={searching ? users.length : undefined} noun="user" />}
          />
        }
      />
      <PageContent>
        <DataTable
          label="Telegram users"
          columns={columns}
          rows={rows}
          getRowId={(user) => user.id}
          onRowClick={(user) =>
            void navigate({ to: "/dashboard/telegram/users/$userId", params: { userId: String(user.id) } })
          }
          rowLabel={telegramUserName}
          rowHref={(user) => `/dashboard/telegram/users/${user.id}`}
          pagination={{
            page: currentPage,
            pageSize,
            total: filtered.length,
            onPage: setPage,
            onPageSize: (size) => {
              setPageSize(size)
              setPage(1)
            },
          }}
          empty={
            searching ? (
              <EmptyState
                icon={UsersRound}
                title="No users match"
                text="Try another name or username."
                action={
                  <Button variant="ghost" size="sm" className={buttonMotion} onClick={() => updateQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={UsersRound}
                title="No Telegram users yet"
                text="Users appear here once the bot has seen them."
              />
            )
          }
        />
      </PageContent>
    </>
  )
}
