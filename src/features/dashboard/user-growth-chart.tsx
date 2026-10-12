import { defineChart, lineY } from "@tanstack/charts"
import { crosshair } from "@tanstack/charts/crosshair"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { Chart } from "@tanstack/react-charts/tooltip"
import { useMemo } from "react"

import { formatNumber } from "@/lib/format"

import type { GrowthPoint, GrowthSeries } from "./user-growth"

const compactNumber = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 })

const CHART_HEIGHT = 200

/**
 * One 2px accent line of the running total over a light grid, month labels below and compact counts on the left.
 * Hover or keyboard focus shows a dashed guide, the point and a tooltip with the bucket's date, total and growth.
 * Paints are CSS variables, so the chart follows the theme without being rebuilt.
 */
export function UserGrowthChart({ series, description }: { series: GrowthSeries; description: string }) {
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(series.points, {
            id: "telegram-users",
            x: "time",
            y: "total",
            key: "time",
            stroke: "var(--pn-accent-solid)",
            strokeWidth: 2,
          }),
          crosshair({ x: { stroke: "var(--pn-fg-subtle)", strokeDasharray: "3 3", strokeWidth: 1 }, y: false }),
        ],
        scales: {
          x: {
            scale: scaleLinear,
            axis: {
              line: false,
              ticks: { values: series.ticks, size: 0, padding: 10, format: series.tickLabel },
              tickLabels: { thin: { minGap: 12 } },
            },
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: { stroke: "var(--pn-line)", strokeOpacity: 1, strokeWidth: 1 },
            axis: {
              line: false,
              ticks: {
                count: 4,
                size: 0,
                padding: 8,
                format: (value: number) => compactNumber.format(value).toLowerCase(),
              },
            },
          },
        },
        theme: {
          foreground: "var(--pn-fg-muted)",
          muted: "var(--pn-fg-muted)",
          grid: "var(--pn-line)",
          focusRing: { radius: 5, fill: "var(--pn-accent-solid)", stroke: "var(--pn-surface)", strokeWidth: 2 },
        },
        focus: "nearest-x",
        maxFocusDistance: Number.POSITIVE_INFINITY,
        tooltip: {
          use: tooltip,
          motion: false,
          sticky: false,
          // The plain-text form is the live region's label; the visible body is `GrowthTooltip`.
          format: (point) => `${point.datum.label}: ${formatNumber(point.datum.total)} users`,
        },
      }),
    [series]
  )

  return (
    <div className="font-mono text-[11px] text-(--pn-fg-muted)">
      <Chart
        definition={definition}
        height={CHART_HEIGHT}
        initialWidth={640}
        ariaLabel="Telegram users over time"
        ariaDescription={description}
        renderTooltipBody={({ primaryPoint }) => (primaryPoint ? <GrowthTooltip point={primaryPoint.datum} /> : null)}
      />
    </div>
  )
}

function GrowthTooltip({ point }: { point: GrowthPoint }) {
  return (
    <span className="flex flex-col gap-0.5 rounded-(--pn-r-3) border border-(--pn-line-strong) bg-(--pn-surface-raised) px-2.5 py-2 font-sans whitespace-nowrap shadow-(--pn-shadow-float)">
      <span className="text-xs text-(--pn-fg-muted)">{point.label}</span>
      <span className="text-[14px] font-semibold text-(--pn-fg) tabular-nums">
        {formatNumber(point.total)}{" "}
        {point.added > 0 ? (
          <span className="font-normal text-(--pn-fg-muted)">+{formatNumber(point.added)}</span>
        ) : null}
      </span>
    </span>
  )
}
