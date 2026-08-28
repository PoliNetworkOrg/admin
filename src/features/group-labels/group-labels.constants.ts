export const GROUP_LABEL_MAX = 60
export const GROUP_LABEL_DESCRIPTION_MAX = 500

export const GROUP_LABEL_COLORS = [
  {
    name: "gray",
    label: "Gray",
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
  },
  {
    name: "red",
    label: "Red",
    dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  },
  {
    name: "orange",
    label: "Orange",
    dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  },
  {
    name: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  {
    name: "green",
    label: "Green",
    dot: "bg-green-500",
    badge: "bg-green-500/10 text-green-700 dark:bg-green-400/15 dark:text-green-300",
  },
  {
    name: "teal",
    label: "Teal",
    dot: "bg-teal-500",
    badge: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  },
  {
    name: "blue",
    label: "Blue",
    dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  },
  {
    name: "indigo",
    label: "Indigo",
    dot: "bg-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
  },
  {
    name: "purple",
    label: "Purple",
    dot: "bg-purple-500",
    badge: "bg-purple-500/10 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
  },
  {
    name: "pink",
    label: "Pink",
    dot: "bg-pink-500",
    badge: "bg-pink-500/10 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300",
  },
] as const

export type GroupLabelColorName = (typeof GROUP_LABEL_COLORS)[number]["name"]

export const GROUP_LABEL_COLOR_NAMES =
  // SAFETY: GROUP_LABEL_COLORS is a non-empty literal array, so mapping its names always yields at least one element.
  GROUP_LABEL_COLORS.map((color) => color.name) as [GroupLabelColorName, ...GroupLabelColorName[]]

export const DEFAULT_GROUP_LABEL_COLOR: GroupLabelColorName = "blue"

export function isGroupLabelColorName(value: string): value is GroupLabelColorName {
  return GROUP_LABEL_COLORS.some((color) => color.name === value)
}

export function getGroupLabelColor(name: GroupLabelColorName) {
  return GROUP_LABEL_COLORS.find((color) => color.name === name) ?? GROUP_LABEL_COLORS[0]
}
