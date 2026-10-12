import { Link, useRouter } from "@tanstack/react-router"
import { ArrowRight, ArrowUp, ChevronRight, Search } from "lucide-react"
import { type ReactNode, Suspense, use, useState } from "react"

import { InlineAlert, LoadingButton, SegmentedControl, useModifierKey } from "@/components/primitives"
import { type DashboardPath, PageBar, PageContent, type Service, ServiceGlyph, useShellFrame } from "@/components/shell"
import { useVisibleServices } from "@/components/shell/use-can"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import type { TelegramUserHistory } from "./overview.functions"
import { GROWTH_RANGES, type GrowthRange, growthSeries } from "./user-growth"
import { UserGrowthChart } from "./user-growth-chart"

/** `null` when its service couldn't be loaded; `undefined` when the user lacks the permission to read it. */
export type OverviewCount = number | null | undefined

export type OverviewCounts = {
  telegramGroups: OverviewCount
  telegramUsers: OverviewCount
  openReports: OverviewCount
  activeGrants: OverviewCount
}

export type OverviewPageProps = {
  counts: OverviewCounts
  /** Streams in after the counts; the chart area holds its height meanwhile. */
  userHistory: Promise<TelegramUserHistory>
}

/** Overview: the search, the Telegram users hero with its chart and side stats, then every service's sections. */
export function DashboardOverviewPage({ counts, userHistory }: OverviewPageProps) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const someFailed = Object.values(counts).some((count) => count === null)

  async function retry() {
    setRetrying(true)
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <>
      <PageBar title="Overview" width="overview" />
      <PageContent width="overview">
        <div className="flex flex-col gap-8">
          <OverviewSearch />

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

          <Hero counts={counts} userHistory={userHistory} />
          <Areas openReports={counts.openReports} />
        </div>
      </PageContent>
    </>
  )
}

/** The big search: opens the command palette, which finds pages and searches users, groups and members. */
function OverviewSearch() {
  const { openPalette } = useShellFrame()
  const modifierKey = useModifierKey()
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      className="-mt-2 flex h-13 w-full items-center gap-3 rounded-(--pn-r-5) border border-(--pn-line-strong) bg-(--pn-surface) px-4 text-left text-[15px] text-(--pn-fg-muted) transition-[border-color] duration-120 hover:border-(--pn-accent) max-shell:h-11"
    >
      <Search aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-(--pn-fg-muted)" />
      <span className="min-w-0 flex-1 truncate">Search users, groups, members or pages…</span>
      <kbd className="rounded-[5px] border border-(--pn-line-strong) bg-(--pn-surface-raised) px-1.5 font-mono text-[11px] leading-4 text-(--pn-fg-muted) pointer-coarse:hidden">
        {modifierKey === "⌘" ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  )
}

function Hero({ counts, userHistory }: OverviewPageProps) {
  const stats: { label: string; value: OverviewCount; to: DashboardPath; flag?: ReactNode }[] = [
    { label: "Telegram groups", value: counts.telegramGroups, to: "/dashboard/telegram/groups" },
    {
      label: "Open reports",
      value: counts.openReports,
      to: "/dashboard/reports/group-links",
      flag: counts.openReports ? (
        <span className="inline-flex h-5.5 items-center rounded-full bg-(--pn-accent-soft) px-2 text-xs font-medium text-(--pn-accent)">
          To review
        </span>
      ) : null,
    },
    { label: "Active grants", value: counts.activeGrants, to: "/dashboard/telegram/grants" },
  ]
  const visibleStats = stats.filter((stat) => stat.value !== undefined)
  const hasUsers = counts.telegramUsers !== undefined

  if (!hasUsers && visibleStats.length === 0) return null

  return (
    <section
      aria-labelledby={hasUsers ? "overview-users" : undefined}
      aria-label={hasUsers ? undefined : "Key numbers"}
      className="flex flex-wrap overflow-hidden rounded-[14px] border border-(--pn-line) bg-(--pn-surface)"
    >
      {hasUsers ? (
        <Suspense fallback={<UsersPanel total={counts.telegramUsers ?? null} history={null} />}>
          <StreamedUsersPanel total={counts.telegramUsers ?? null} userHistory={userHistory} />
        </Suspense>
      ) : null}
      {visibleStats.length > 0 ? (
        <div
          className={cn(
            "flex flex-[1_1_260px] flex-col justify-center gap-0.5 p-2",
            hasUsers && "border-(--pn-line) max-shell:flex-row max-shell:border-t max-shell:p-1.5 shell:border-l"
          )}
        >
          {visibleStats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              className="group/stat flex min-w-0 items-center gap-3 rounded-(--pn-r-4) px-5 py-4.5 text-(--pn-fg) transition-[background-color] duration-120 hover:bg-[color-mix(in_oklch,var(--pn-muted)_70%,var(--pn-surface))] max-shell:flex-1 max-shell:px-3 max-shell:py-2.5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] text-(--pn-fg-muted)">{stat.label}</span>
                <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {stat.value === null ? (
                    <span
                      role="img"
                      aria-label="Couldn't load"
                      className="text-[28px] leading-8.5 font-semibold text-(--pn-fg-muted) max-shell:text-[22px] max-shell:leading-7"
                    >
                      —
                    </span>
                  ) : (
                    <span className="text-[28px] leading-8.5 font-semibold tabular-nums max-shell:text-[22px] max-shell:leading-7">
                      {formatNumber(stat.value ?? 0)}
                    </span>
                  )}
                  {stat.flag}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="size-4.5 shrink-0 text-(--pn-fg-subtle) transition-[transform,color] duration-120 group-hover/stat:translate-x-0.5 group-hover/stat:text-(--pn-fg) max-shell:hidden"
              />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function StreamedUsersPanel({
  total,
  userHistory,
}: {
  total: number | null
  userHistory: Promise<TelegramUserHistory>
}) {
  return <UsersPanel total={total} history={use(userHistory)} />
}

/** The Telegram users total, its growth over the chosen range and the chart. `history` is null while loading. */
function UsersPanel({ total, history }: { total: number | null; history: TelegramUserHistory | null }) {
  const [range, setRange] = useState<GrowthRange>("1y")
  const ok = history?.status === "ok" ? history : null
  const series = ok ? growthSeries(ok.days, ok.today, range) : null
  const span = GROWTH_RANGES.find((option) => option.value === range)?.span
  const loading = history === null
  const showChart = loading || ok !== null

  return (
    <div
      className={cn(
        "flex min-w-0 flex-[999_1_520px] flex-col gap-4.5 p-5.5 pb-4.5 max-shell:p-4",
        !showChart && "justify-center"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="overview-users" className="text-[14px] font-medium text-(--pn-fg-muted)">
            <Link to="/dashboard/telegram/users" className="transition-[color] duration-120 hover:text-(--pn-fg)">
              Telegram users
            </Link>
          </h2>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {total === null ? (
              <span
                role="img"
                aria-label="Couldn't load"
                className="text-[44px] leading-12 font-semibold text-(--pn-fg-muted)"
              >
                —
              </span>
            ) : (
              <span className="text-[44px] leading-12 font-semibold tracking-[-0.02em] tabular-nums max-shell:text-[38px] max-shell:leading-11">
                {formatNumber(total)}
              </span>
            )}
            {series && span && series.added > 0 ? (
              <span className="inline-flex items-center gap-1 text-[13px] text-(--pn-accent) tabular-nums">
                <ArrowUp aria-hidden strokeWidth={2} className="size-3.5" />+{formatNumber(series.added)} {span}
              </span>
            ) : null}
          </div>
        </div>
        {showChart ? (
          <SegmentedControl
            label="Time range"
            items={GROWTH_RANGES.map(({ value, label, ariaLabel }) => ({ value, label, ariaLabel }))}
            value={range}
            onValueChange={setRange}
            disabled={loading}
          />
        ) : null}
      </div>

      {series ? (
        <UserGrowthChart series={series} description={chartDescription(series.points, range)} />
      ) : loading ? (
        <div
          aria-hidden
          className="h-[200px] animate-pulse rounded-(--pn-r-3) bg-(--pn-muted) motion-reduce:animate-none"
        />
      ) : history?.status === "error" ? (
        <p className="text-[13px] text-(--pn-fg-muted)">The user history couldn't be loaded.</p>
      ) : null}
    </div>
  )
}

function chartDescription(points: ReturnType<typeof growthSeries>["points"], range: GrowthRange) {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return "No users yet."
  const scope = GROWTH_RANGES.find((option) => option.value === range)?.ariaLabel ?? ""
  return `${scope}: from ${formatNumber(first.total)} users (${first.label}) to ${formatNumber(last.total)} (${last.label}).`
}

/** Every service the user can open: the whole card leads where its rail icon does, each section is a 44px button. */
function Areas({ openReports }: { openReports: OverviewCount }) {
  const services = useVisibleServices().filter((service) => service.sections.length > 0)
  return (
    <section aria-labelledby="overview-areas" className="flex flex-col gap-4">
      <h2 id="overview-areas" className="text-[18px]/6 font-semibold text-(--pn-fg)">
        Areas
      </h2>
      <ul className="grid gap-4 min-[760px]:grid-cols-2 min-[980px]:grid-cols-3">
        {services.map((service) => (
          <AreaCard key={service.id} service={service} openReports={openReports} />
        ))}
      </ul>
    </section>
  )
}

function AreaCard({ service, openReports }: { service: Service; openReports: OverviewCount }) {
  const { serviceHref } = useShellFrame()
  const wide = service.sections.length > 3
  return (
    <li
      className={cn(
        "group/area relative flex flex-col gap-4 rounded-[14px] border border-(--pn-line) bg-(--pn-surface) p-4.5 transition-[background-color,border-color] duration-120 hover:border-(--pn-accent) hover:bg-(--pn-accent-soft)",
        wide && "min-[980px]:col-span-2"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-muted) text-(--pn-fg)">
          <ServiceGlyph service={service} className="size-5" />
        </span>
        <h3 className="flex-1 text-[17px] font-semibold text-(--pn-fg)">
          {/* The card's link: its ::after covers the card, the section buttons sit above it. */}
          <Link
            to={serviceHref(service)}
            className="after:absolute after:inset-0 after:rounded-[14px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--pn-focus)"
          >
            {service.title}
          </Link>
        </h3>
        <ArrowRight
          aria-hidden
          className="size-4.5 shrink-0 text-(--pn-fg-subtle) transition-[transform,color] duration-120 group-hover/area:translate-x-0.5 group-hover/area:text-(--pn-fg)"
        />
      </div>
      <div className={cn("grid gap-1.5", wide && "grid-cols-2")}>
        {service.sections.map((section) => (
          <Link
            key={section.id}
            to={section.path}
            className="group/section relative z-[1] flex h-11 min-w-0 items-center gap-2.5 rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-muted) px-3 text-[14px] font-medium text-(--pn-fg) transition-[background-color,border-color] duration-120 hover:border-(--pn-accent) hover:bg-(--pn-nav-active)"
          >
            <section.icon
              aria-hidden
              strokeWidth={1.75}
              className="size-4.5 shrink-0 text-(--pn-fg-muted) group-hover/section:text-(--pn-fg)"
            />
            <span className="line-clamp-2 min-w-0 flex-1 leading-4.5">{section.title}</span>
            {service.id === "reports" && section.id === "open" && openReports ? (
              <span className="rounded-full bg-(--pn-accent-soft) px-1.75 font-mono text-[11px] leading-4.5 font-medium text-(--pn-accent) tabular-nums">
                {formatNumber(openReports)}
                <span className="sr-only"> open</span>
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </li>
  )
}
