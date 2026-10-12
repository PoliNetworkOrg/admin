import { createServerFn } from "@tanstack/react-start"
import { TRPCClientError } from "@trpc/client"
import { z } from "zod"

import { adminMiddleware } from "@/server/auth.middleware"
import type { BackendClient } from "@/server/backend.server"
import { hasPermission, type Permission } from "@/server/permissions"

import type { OverviewCount, OverviewCounts } from "./overview-page"
import type { UserCreationDay } from "./user-growth"

/** `undefined` when the user lacks the permission, so the overview hides the count instead of reporting a failure. */
function countOf<T>(result: PromiseSettledResult<T | undefined>, count: (value: T) => number): OverviewCount {
  if (result.status === "rejected") {
    console.error(result.reason)
    return null
  }
  return result.value === undefined ? undefined : count(result.value)
}

/** Aggregate on the server so the landing page receives counts instead of entire directories. */
export const getOverviewCounts = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }): Promise<OverviewCounts> => {
    const { backend, permissions } = context
    const ifAllowed = <T>(permission: Permission, load: () => Promise<T>) =>
      hasPermission(permissions, permission) ? load() : Promise.resolve(undefined)
    const [groups, users, reports, grants] = await Promise.allSettled([
      backend.tg.groups.getAll.query(),
      ifAllowed("tg:users:read", () =>
        backend.tg.users.getAll.query().then((result) => {
          if (result.error) throw new Error(result.error)
          return result.users ?? []
        })
      ),
      ifAllowed("web:reports:manage", () => backend.web.reports.list.query({ statuses: ["pending"] })),
      ifAllowed("tg:grants:read", () => backend.tg.grants.getOngoing.query()),
    ])
    return {
      telegramGroups: countOf(groups, (all) => all.length),
      telegramUsers: countOf(users, (all) => all.length),
      openReports: countOf(reports, (all) => all.length),
      activeGrants: countOf(grants, (ongoing) => ongoing.grants.length),
    }
  })

/**
 * `forbidden` without `tg:users:read`; `unavailable` while the backend predates `tg.users.getCreationHistory` or refuses
 * the call as unauthenticated (agent mode's anonymous path), so the Overview shows the total without the chart instead
 * of an error.
 */
export type TelegramUserHistory =
  | { status: "ok"; days: UserCreationDay[]; today: string }
  | { status: "forbidden" | "unavailable" | "error" }

const creationDaysSchema = z.array(
  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), count: z.number().int().nonnegative() })
)

const creationHistorySchema = z.union([
  creationDaysSchema.transform((days) => ({ days, error: null })),
  z.object({
    days: creationDaysSchema,
    error: z.null(),
  }),
  z.object({ error: z.string(), days: z.null().optional() }),
])

/** The users router as the backend serves it since PoliNetworkOrg/backend#68. */
type UsersWithCreationHistory = BackendClient["tg"]["users"] & {
  getCreationHistory: { query: () => Promise<z.input<typeof creationHistorySchema>> }
}

/**
 * Calls `tg.users.getCreationHistory`, which is newer than the pinned `@polinetwork/backend` types, and parses its
 * output here. Call `context.backend.tg.users.getCreationHistory.query()` directly once the package is bumped to the
 * release that includes it. A backend without the procedure answers NOT_FOUND.
 */
async function creationHistory(backend: BackendClient) {
  // SAFETY: the tRPC client is a path proxy, so any property is a callable procedure path; the backend validates it
  // (NOT_FOUND when absent) and the result is parsed below instead of trusted.
  const users = backend.tg.users as UsersWithCreationHistory
  return creationHistorySchema.parse(await users.getCreationHistory.query())
}

/** Today in Europe/Rome as "YYYY-MM-DD", the same calendar the backend groups by. */
function romeToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date())
}

/** New Telegram users per day, for the Overview chart. Only dates and counts cross the BFF. */
export const getTelegramUserHistory = createServerFn()
  .middleware([adminMiddleware])
  .handler(async ({ context }): Promise<TelegramUserHistory> => {
    if (!hasPermission(context.permissions, "tg:users:read")) return { status: "forbidden" }
    try {
      const result = await creationHistory(context.backend)
      if (result.error !== null) throw new Error(result.error)
      return { status: "ok", days: result.days, today: romeToday() }
    } catch (error) {
      // NOT_FOUND: a backend that predates the procedure. UNAUTHORIZED: the procedure is token-only, and agent mode
      // (development) calls the backend anonymously. Either way the Overview shows the total without the chart.
      if (
        error instanceof TRPCClientError &&
        (error.data?.code === "NOT_FOUND" || error.data?.code === "UNAUTHORIZED")
      ) {
        return { status: "unavailable" }
      }
      console.error(error)
      return { status: "error" }
    }
  })
