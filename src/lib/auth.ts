/** The signed-in user as the dashboard shows them: ID-token claims plus the linked Telegram account from `me.access`. */
export type DashboardUser = {
  sub: string
  name: string
  email: string
  picture: string | null
  telegramId: string | null
}

export type DashboardAccess =
  | { status: "authorized"; user: DashboardUser; permissions: string[] }
  /** Signed in without `admin:access`; `stale` when the backend's permission snapshot is out of date. */
  | { status: "forbidden"; user: DashboardUser; stale: boolean }

export type DashboardAccessState = DashboardAccess | { status: "unauthenticated" }
