import type { CSSProperties } from "react"

export const GROUP_LABEL_MAX = 128
export const GROUP_LABEL_DESCRIPTION_MAX = 500

export const GROUP_LABEL_COLORS = [
  {
    hex: "#64748b",
    label: "Gray",
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
  },
  {
    hex: "#ef4444",
    label: "Red",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  },
  {
    hex: "#f97316",
    label: "Orange",
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
  {
    hex: "#f59e0b",
    label: "Amber",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  {
    hex: "#22c55e",
    label: "Green",
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-700 dark:bg-green-400/15 dark:text-green-300",
  },
  {
    hex: "#14b8a6",
    label: "Teal",
    dot: "bg-teal-500",
    badge: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  },
  {
    hex: "#3b82f6",
    label: "Blue",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  },
  {
    hex: "#6366f1",
    label: "Indigo",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
  },
  {
    hex: "#a855f7",
    label: "Purple",
    dot: "bg-purple-500",
    badge: "bg-purple-500/10 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
  },
  {
    hex: "#ec4899",
    label: "Pink",
    dot: "bg-pink-500",
    badge: "bg-pink-500/10 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
  },
] as const

export const DEFAULT_GROUP_LABEL_COLOR: string = GROUP_LABEL_COLORS[6].hex // Blue

export function isGroupLabelHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

export function isSameGroupLabel(a: { label: string }, b: { label: string }): boolean {
  return a.label === b.label
}

type GroupLabelSwatch = {
  hex: string
  label: string
  dotClassName: string
  dotStyle?: CSSProperties
  badgeClassName: string
  badgeStyle?: CSSProperties
}

/** Falls back to an outline swatch styled with the raw hex, for colors set outside this curated palette. */
export function getGroupLabelColor(hex: string): GroupLabelSwatch {
  const match = GROUP_LABEL_COLORS.find((color) => color.hex.toLowerCase() === hex.toLowerCase())
  if (match) return { hex: match.hex, label: match.label, dotClassName: match.dot, badgeClassName: match.badge }

  return {
    hex,
    label: "Custom",
    dotClassName: "",
    dotStyle: { backgroundColor: hex },
    badgeClassName: "border bg-transparent",
    badgeStyle: { borderColor: hex, color: hex },
  }
}
