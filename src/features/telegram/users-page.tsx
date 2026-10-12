import { useNavigate } from "@tanstack/react-router"
import { ChevronRight, UsersRound } from "lucide-react"
import { useDeferredValue, useMemo, useState } from "react"

import { buttonMotion, DataTable, type DataTableColumn, EmptyState, initialsOf } from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { Count, PageBar, PageContent, Toolbar } from "@/components/shell"
import { telegramUserName } from "@/components/telegram/telegram-user"
import { Button } from "@/components/ui/button"
import type { TgUser } from "@/lib/api/types"
import { formatNumber } from "@/lib/format"

function matchesUser(user: TgUser, query: string) {
  if (!query) return true
  if (String(user.id).includes(query)) return true
  const haystack = [user.firstName, user.lastName, user.username].filter(Boolean).join(" ").toLocaleLowerCase()
  return haystack.includes(query)
}

// No roles column: `tg.users.getAll` does not return roles and the backend has no bulk roles query.
const columns: DataTableColumn<TgUser>[] = [
  {
    id: "name",
    label: "Name",
    minWidth: 220,
    cell: (user) => {
      const name = telegramUserName(user)
      return (
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-muted) text-[11px] font-semibold text-(--pn-fg-muted)"
          >
            {initialsOf(name)}
          </span>
          <Hint label={name}>
            <span className="truncate">{name}</span>
          </Hint>
        </span>
      )
    },
  },
  {
    id: "username",
    label: "Username",
    minWidth: 180,
    priority: 2,
    cell: (user) => (user.username ? `@${user.username}` : <span className="text-(--pn-fg-subtle)">No username</span>),
  },
  {
    id: "telegramId",
    label: "Telegram ID",
    mono: true,
    priority: 1,
    cell: (user) => user.id,
  },
  {
    // Signals that the row opens the user's detail; the row itself is the link target.
    id: "open",
    label: "",
    // A fixed width switches the table to fixed layout: Name, Username and Telegram ID (all short) share the rest
    // equally instead of Name taking it all. 16px icon + 16px cell padding on each side. Cards drop it.
    width: 52,
    mobile: "hidden",
    cell: () => (
      <ChevronRight
        aria-hidden
        className="size-4 text-(--pn-fg-subtle) transition-[color,translate] duration-120 [tr:hover_&]:translate-x-0.5 [tr:hover_&]:text-(--pn-fg-muted)"
      />
    ),
  },
]

const PAGE_SIZE = 20

/** Telegram users: searchable list; a row opens the user's detail. */
export function TelegramUsersPage({ users, initialQuery = "" }: { users: TgUser[]; initialQuery?: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [syncedQuery, setSyncedQuery] = useState(initialQuery)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  // A later navigation to this page with another `?q=` (the command palette's "Find …") replaces the search.
  if (initialQuery !== syncedQuery) {
    setSyncedQuery(initialQuery)
    setQuery(initialQuery)
    setPage(1)
  }
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
        description={`${formatNumber(users.length)} ${users.length === 1 ? "person" : "people"} the bot has seen`}
        left={
          <Toolbar
            search={{ value: query, onChange: updateQuery }}
            count={searching ? <Count value={filtered.length} total={users.length} noun="user" /> : undefined}
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
