import { createFileRoute } from "@tanstack/react-router"
import { CalendarClock } from "lucide-react"
import { useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { getOngoingGrants, getScheduledGrants } from "@/server/api.functions"

type Grant = {
  userId: number
  grantorId?: number
  role?: string
  createdAt?: string
  expiresAt?: string | null
  scheduledAt?: string | null
}
export const Route = createFileRoute("/dashboard/telegram/grants")({
  loader: async () => ({ ongoing: await getOngoingGrants(), scheduled: await getScheduledGrants() }),
  component: Grants,
})

function Grants() {
  const { ongoing, scheduled } = Route.useLoaderData()
  const [tab, setTab] = useState<"all" | "ongoing" | "scheduled">("all")
  const ongoingGrants = (ongoing.data as { grants?: Grant[] }).grants ?? []
  const scheduledGrants = (scheduled.data as { grants?: Grant[] }).grants ?? []
  const grants =
    tab === "ongoing" ? ongoingGrants : tab === "scheduled" ? scheduledGrants : [...ongoingGrants, ...scheduledGrants]
  const connected = ongoing.connected && scheduled.connected
  return (
    <div className="data-page reveal">
      <DataToolbar
        title="Access grants"
        description="See who has temporary access, when it begins, and when it expires."
        count={grants.length}
        action="New grant"
      />
      <LiveStatus connected={connected} message={ongoing.message ?? scheduled.message} />
      <div className="segmented" role="tablist">
        <button className={tab === "all" ? "selected" : ""} onClick={() => setTab("all")}>
          All <b>{ongoingGrants.length + scheduledGrants.length}</b>
        </button>
        <button className={tab === "ongoing" ? "selected" : ""} onClick={() => setTab("ongoing")}>
          Ongoing <b>{ongoingGrants.length}</b>
        </button>
        <button className={tab === "scheduled" ? "selected" : ""} onClick={() => setTab("scheduled")}>
          Scheduled <b>{scheduledGrants.length}</b>
        </button>
      </div>
      {grants.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Granted by</th>
                <th>Schedule</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant, index) => (
                <tr key={`${grant.userId}-${index}`}>
                  <td className="mono">{grant.userId}</td>
                  <td>
                    <span className="tag">{grant.role ?? "Access grant"}</span>
                  </td>
                  <td className="mono">{grant.grantorId ?? "—"}</td>
                  <td>{grant.scheduledAt ?? grant.createdAt ?? "—"}</td>
                  <td>
                    <span className={`status-pill ${grant.scheduledAt ? "quiet" : ""}`}>
                      {grant.scheduledAt ? "Scheduled" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="No grants in this view"
          text="Create a grant to give a member scoped, auditable access."
        />
      )}
    </div>
  )
}
