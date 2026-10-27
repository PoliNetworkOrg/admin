import {
  Bell,
  BookOpen,
  ChartNoAxesColumn,
  DollarSign,
  Folder,
  Home,
  Map as MapIcon,
  Monitor,
  Radio,
  RefreshCw,
  Repeat,
  ShoppingCart,
  UserCheck,
  Users,
} from "lucide-react"
import { useId } from "react"

import { Hint } from "@/components/primitives"
import { cn } from "@/lib/utils"

import { FRESHMAN_ICON_NAMES } from "./freshman.constants"
import type { FreshmanIcon } from "./types"

export const FRESHMAN_ICONS = {
  chart: ChartNoAxesColumn,
  monitor: Monitor,
  book: BookOpen,
  map: MapIcon,
  news: Radio,
  money: DollarSign,
  folder: Folder,
  repeat: Repeat,
  refresh: RefreshCw,
  bell: Bell,
  user: UserCheck,
  users: Users,
  cart: ShoppingCart,
  home: Home,
}

const ICON_LABELS = {
  chart: "Chart",
  monitor: "Monitor",
  book: "Book",
  map: "Map",
  news: "News",
  money: "Money",
  folder: "Folder",
  repeat: "Repeat",
  refresh: "Refresh",
  bell: "Bell",
  user: "User",
  users: "Users",
  cart: "Cart",
  home: "Home",
} satisfies Record<FreshmanIcon, string>
const GRID_COLUMNS = 5
const ARROW_STEPS = new Map([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
  ["ArrowDown", GRID_COLUMNS],
  ["ArrowUp", -GRID_COLUMNS],
])

/** Same radio-grid interaction as the existing FAQ category icon picker. */
export function FreshmanIconPicker({
  value,
  onValueChange,
}: {
  value: FreshmanIcon
  onValueChange: (icon: FreshmanIcon) => void
}) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-medium">
        Icon
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="grid w-fit grid-cols-5 gap-1">
        {FRESHMAN_ICON_NAMES.map((name, index) => {
          const Icon = FRESHMAN_ICONS[name]
          const selected = value === name
          return (
            <Hint key={name} label={ICON_LABELS[name]}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={ICON_LABELS[name]}
                tabIndex={selected ? 0 : -1}
                onClick={() => onValueChange(name)}
                onKeyDown={(event) => {
                  const step = ARROW_STEPS.get(event.key)
                  if (step === undefined && event.key !== "Home" && event.key !== "End") return
                  event.preventDefault()
                  const nextIndex =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? FRESHMAN_ICON_NAMES.length - 1
                        : (index + (step ?? 0) + FRESHMAN_ICON_NAMES.length) % FRESHMAN_ICON_NAMES.length
                  const next = FRESHMAN_ICON_NAMES[nextIndex]
                  onValueChange(next)
                  const group = event.currentTarget.closest('[role="radiogroup"]')
                  group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
                }}
                className={cn(
                  "grid size-9 place-items-center rounded-(--pn-r-3) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-hover) hover:text-(--pn-fg)",
                  selected &&
                    "bg-(--pn-accent-soft) text-(--pn-accent) ring-1 ring-(--pn-accent) ring-inset hover:bg-(--pn-accent-soft-hover) hover:text-(--pn-accent)"
                )}
              >
                <Icon aria-hidden strokeWidth={1.75} className="size-4" />
              </button>
            </Hint>
          )
        })}
      </div>
    </div>
  )
}
