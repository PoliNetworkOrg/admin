import { Link, useRouter } from "@tanstack/react-router"
import { ChevronRight, Cloud, EyeOff, Inbox, type LucideIcon, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Chip, EmptyState, InlineAlert, LoadingButton, SectionHeading, StatTile } from "@/components/primitives"
import { type DashboardPath, PageBar, PageContent, panelServices, ServiceGlyph } from "@/components/shell"
import { pluralize } from "@/lib/format"

/** Each count is null when its service couldn't be loaded. */
export type OverviewCounts = {
  telegramGroups: number | null
  hiddenGroups: number | null
  telegramUsers: number | null
  openReports: number | null
  activeGrants: number | null
  expiringGrants: number | null
  smallM365Groups: number | null
}

type AttentionItem = { id: string; icon: LucideIcon; text: string; to: DashboardPath; count: number | null }

function attentionItems(counts: OverviewCounts): AttentionItem[] {
  const { openReports, hiddenGroups, expiringGrants, smallM365Groups } = counts
  return [
    {
      id: "reports",
      icon: Inbox,
      count: openReports,
      text: pluralize(openReports ?? 0, "open report"),
      to: "/dashboard/reports/group-links",
    },
    {
      id: "hidden",
      icon: EyeOff,
      count: hiddenGroups,
      text: pluralize(hiddenGroups ?? 0, "hidden Telegram group"),
      to: "/dashboard/telegram/groups",
    },
    {
      id: "grants",
      icon: ShieldCheck,
      count: expiringGrants,
      text: `${pluralize(expiringGrants ?? 0, "grant")} ${expiringGrants === 1 ? "expires" : "expire"} within 7 days`,
      to: "/dashboard/telegram/grants",
    },
    {
      id: "m365",
      icon: Cloud,
      count: smallM365Groups,
      text: `${pluralize(smallM365Groups ?? 0, "Microsoft 365 group")} with 0–1 member`,
      to: "/dashboard/azure/groups",
    },
  ]
}

/** Overview (docs/design.md §7.1): four stat tiles, what needs attention, and every service's sections. */
export function DashboardOverviewPage({ counts }: { counts: OverviewCounts }) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  const attention = attentionItems(counts).filter((item) => item.count !== null && item.count > 0)
  const someFailed = Object.values(counts).some((count) => count === null)

  async function retry() {
    setRetrying(true)
    await router.invalidate({ sync: true })
    setRetrying(false)
  }

  return (
    <>
      <PageBar title="Overview" />
      <PageContent width="overview">
        <div className="flex flex-col gap-8">
          {someFailed ? (
            <InlineAlert
              tone="warning"
              action={
                <LoadingButton variant="outline" size="sm" pending={retrying} onClick={() => void retry()}>
                  Retry
                </LoadingButton>
              }
            >
              Some services couldn't be reached, so their counts show —.
            </InlineAlert>
          ) : null}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Telegram groups"
              value={counts.telegramGroups}
              render={<Link to="/dashboard/telegram/groups" />}
            />
            <StatTile
              label="Telegram users"
              value={counts.telegramUsers}
              render={<Link to="/dashboard/telegram/users" />}
            />
            <StatTile
              label="Open reports"
              value={counts.openReports}
              render={<Link to="/dashboard/reports/group-links" />}
            />
            <StatTile
              label="Active grants"
              value={counts.activeGrants}
              render={<Link to="/dashboard/telegram/grants" />}
            />
          </div>

          <section aria-labelledby="overview-attention" className="flex flex-col gap-3">
            <SectionHeading id="overview-attention" title="Needs attention" />
            <div className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">
              {attention.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nothing needs attention"
                  text={
                    someFailed
                      ? "Services that couldn't be reached weren't checked."
                      : "Reports, hidden groups and expiring grants will appear here."
                  }
                />
              ) : (
                <ul>
                  {attention.map(({ id, icon: Icon, text, to }) => (
                    <li key={id} className="border-b border-(--pn-line) last:border-b-0">
                      <Link
                        to={to}
                        className="flex h-11 items-center gap-3 px-5 text-[13px] text-(--pn-fg) tabular-nums transition-[background-color] duration-120 hover:bg-(--pn-muted) focus-visible:outline-offset-[-2px]"
                      >
                        <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-(--pn-fg-muted)" />
                        <span className="min-w-0 flex-1 truncate">{text}</span>
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="overview-areas" className="flex flex-col gap-3">
            <SectionHeading id="overview-areas" title="Areas" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {panelServices.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-col gap-3 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) p-4"
                >
                  <h3 className="flex items-center gap-2 text-[14px] leading-5 font-semibold text-(--pn-fg)">
                    <ServiceGlyph service={service} className="size-4 text-(--pn-fg-muted)" />
                    {service.title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {service.sections.map((section) => (
                      <Chip key={section.id} render={<Link to={section.path} />} className="h-7 px-2.5 text-[13px]">
                        {section.title}
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </PageContent>
    </>
  )
}
