import { motion, useReducedMotion } from "motion/react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

function Block({ className }: { className?: string }) {
  return <div className={cn("rounded-(--pn-r-2) bg-(--pn-muted)", className)} />
}

/** One region-wide pulse (1 → .6 → 1 over 1.4s); static under reduced motion. */
function Pulse({
  label,
  className,
  bodyClassName,
  children,
}: {
  label: string
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <motion.div
        aria-hidden
        className={bodyClassName}
        animate={reduceMotion ? undefined : { opacity: [1, 0.6, 1] }}
        transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      >
        {children}
      </motion.div>
    </div>
  )
}

const cellWidths = ["w-2/5", "w-1/3", "w-1/4", "w-1/2", "w-1/5"]

/** Skeleton `<tr>`s for a real `<thead>`; used by `DataTable`. */
export function SkeletonRows({ columns, rows = 8 }: { columns: number; rows?: number }) {
  const reduceMotion = useReducedMotion()
  return Array.from({ length: rows }, (_, row) => (
    <motion.tr
      key={row}
      aria-hidden
      className="h-13 border-b border-(--pn-line) last:border-0 max-shell:flex max-shell:items-center max-shell:gap-3 max-shell:px-3.5"
      animate={reduceMotion ? undefined : { opacity: [1, 0.6, 1] }}
      transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
    >
      {Array.from({ length: columns }, (_, column) => (
        <td key={column} className="px-4 max-shell:p-0 max-shell:[&:nth-child(n+3)]:hidden">
          <Block className={cn("h-3", cellWidths[(row + column) % cellWidths.length])} />
        </td>
      ))}
    </motion.tr>
  ))
}

type TableSkeletonProps = { columns: number; rows?: number; label?: string; className?: string }

export function TableSkeleton({ columns, rows = 8, label = "Loading…", className }: TableSkeletonProps) {
  return (
    <Pulse
      label={label}
      className={cn("overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)", className)}
    >
      <div className="flex h-10.5 items-center gap-8 border-b border-(--pn-line) px-4">
        {Array.from({ length: columns }, (_, column) => (
          <div key={column} className={cn("flex-1", column === 0 && "flex-2")}>
            <Block className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-13 items-center gap-8 border-b border-(--pn-line) px-4 last:border-0">
          {Array.from({ length: columns }, (_, column) => (
            <Block key={column} className={cn("h-3 flex-1", column === 0 && "flex-2")} />
          ))}
        </div>
      ))}
    </Pulse>
  )
}

type CardsSkeletonProps = {
  count?: number
  /** Projects use 1: their order matters, so they read as one list. */
  columns?: 1 | 2
  label?: string
  className?: string
}

/** Card-collection geometry: logo + title row, link line, two description blocks. */
export function CardsSkeleton({ count = 4, columns = 2, label = "Loading…", className }: CardsSkeletonProps) {
  return (
    <Pulse label={label} className={className}>
      <div className={cn("grid gap-4", columns === 2 && "lg:grid-cols-2")}>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) p-4"
          >
            <div className="flex items-center gap-3">
              <Block className="size-10 rounded-(--pn-r-3)" />
              <Block className="h-3.5 w-40" />
            </div>
            <Block className="h-3 w-32" />
            <Block className="h-16 w-full" />
            <Block className="h-16 w-full" />
          </div>
        ))}
      </div>
    </Pulse>
  )
}

/** Record detail geometry: header block + three section cards. */
export function RecordSkeleton({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <Pulse label={label} className={className}>
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4 border-b border-(--pn-line) pb-6">
          <Block className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Block className="h-5 w-56" />
            <Block className="h-3 w-32" />
          </div>
        </div>
        {[3, 4, 2].map((rows, index) => (
          <div key={index} className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">
            <div className="flex h-14 items-center px-5">
              <Block className="h-3.5 w-36" />
            </div>
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex h-14 items-center gap-6 border-t border-(--pn-line) px-5">
                <Block className="h-3 w-1/3" />
                <Block className="h-3 w-1/5" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Pulse>
  )
}

type SettingsListSkeletonProps = { rows?: number; label?: string; className?: string }

/** 56px rows with icon, title and meta line, as in the Account cards. */
export function SettingsListSkeleton({ rows = 2, label = "Loading…", className }: SettingsListSkeletonProps) {
  return (
    <Pulse label={label} className={className}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-14 items-center gap-3 border-b border-(--pn-line) last:border-0">
          <Block className="size-4" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Block className="h-3 w-40" />
            <Block className="h-2.5 w-56" />
          </div>
          <Block className="size-9 rounded-(--pn-r-3)" />
        </div>
      ))}
    </Pulse>
  )
}

/**
 * A workspace that fills the window, as the signature request composer does: a document surface and, from 900px of
 * width, a column beside it.
 */
export function WorkspaceSkeleton({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <Pulse
      label={label}
      className={cn("@container/skeleton", className)}
      bodyClassName="flex flex-col gap-4 @min-[900px]/skeleton:grid @min-[900px]/skeleton:h-[max(480px,calc(100dvh-112px))] @min-[900px]/skeleton:grid-cols-[minmax(0,1fr)_380px] @min-[1040px]/skeleton:grid-cols-[minmax(0,1fr)_400px]"
    >
      <div className="flex h-[60dvh] flex-col rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface) @min-[900px]/skeleton:h-auto">
        <div className="flex h-11 items-center border-b border-(--pn-line) px-3">
          <Block className="h-3 w-40" />
        </div>
        {["w-1/3", "w-1/4", "w-2/5"].map((width) => (
          <div key={width} className="flex h-11 items-center gap-3 px-3">
            <Block className="size-4" />
            <Block className={cn("h-3", width)} />
          </div>
        ))}
      </div>
      <div className="min-h-40 rounded-(--pn-r-5) border border-dashed border-(--pn-line-strong)" />
    </Pulse>
  )
}

/** Bars in place of lines still being worked out, e.g. a list read from a document; they share the height, 4px apart. */
export function BarSkeleton({
  label = "Loading…",
  bars = 1,
  className,
}: {
  label?: string
  bars?: number
  className?: string
}) {
  return (
    <Pulse label={label} className={className} bodyClassName="flex h-full flex-col gap-1">
      {Array.from({ length: bars }, (_, bar) => (
        <Block key={bar} className="min-h-0 flex-1" />
      ))}
    </Pulse>
  )
}
