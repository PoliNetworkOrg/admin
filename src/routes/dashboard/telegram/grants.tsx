import { createFileRoute } from "@tanstack/react-router"
import { CalendarClock } from "lucide-react"
import { useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  pendingComponent: () => <DataPageSkeleton columns={5} withTabs />,
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
    <div className="animate-appear">
      <DataToolbar
        title="Access grants"
        description="See who has temporary access, when it begins, and when it expires."
        count={grants.length}
        action="New grant"
      />
      <LiveStatus connected={connected} message={ongoing.message ?? scheduled.message} />
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={1}
        value={[tab]}
        onValueChange={(value) => {
          const next = value[0]
          if (next === "all" || next === "ongoing" || next === "scheduled") setTab(next)
        }}
        className="my-1"
        aria-label="Grant status"
      >
        <ToggleGroupItem
          value="all"
          className="rounded-none text-[10px] text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
        >
          All <b className="ml-1 font-mono text-[10px]">{ongoingGrants.length + scheduledGrants.length}</b>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="ongoing"
          className="rounded-none text-[10px] text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
        >
          Ongoing <b className="ml-1 font-mono text-[10px]">{ongoingGrants.length}</b>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="scheduled"
          className="rounded-none text-[10px] text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-primary"
        >
          Scheduled <b className="ml-1 font-mono text-[10px]">{scheduledGrants.length}</b>
        </ToggleGroupItem>
      </ToggleGroup>
      {grants.length ? (
        <div className="overflow-auto border border-border bg-card">
          <Table className="min-w-[700px] text-left">
            <TableHeader>
              <tr>
                <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                  User
                </TableHead>
                <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                  Role
                </TableHead>
                <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                  Granted by
                </TableHead>
                <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                  Schedule
                </TableHead>
                <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
                  Status
                </TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {grants.map((grant, index) => (
                <TableRow key={`${grant.userId}-${index}`} className="hover:bg-[#f6f9fe]">
                  <TableCell className="px-[15px] py-3 font-mono text-[10px] text-[#51647f]">{grant.userId}</TableCell>
                  <TableCell className="px-[15px] py-3">
                    <Badge className="h-5 rounded-none bg-accent px-1.5 font-mono text-[9px] text-primary">
                      {grant.role ?? "Access grant"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-[15px] py-3 font-mono text-[10px] text-[#51647f]">
                    {grant.grantorId ?? "—"}
                  </TableCell>
                  <TableCell className="px-[15px] py-3 text-xs">
                    {grant.scheduledAt ?? grant.createdAt ?? "—"}
                  </TableCell>
                  <TableCell className="px-[15px] py-3">
                    <Badge
                      variant={grant.scheduledAt ? "secondary" : "default"}
                      className="h-5 rounded-none px-1.5 font-mono text-[9px]"
                    >
                      {grant.scheduledAt ? "Scheduled" : "Active"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
