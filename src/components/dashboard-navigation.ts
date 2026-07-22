import {
  BookOpen,
  Database,
  Globe,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react"
import azureIcon from "@/assets/svg/azure.svg"
import telegramIcon from "@/assets/svg/telegram.svg"

export type DashboardNavigationItem = {
  title: string
  url: string
  icon: LucideIcon
}

export type DashboardNavigationCategory = {
  title: string
  icon: LucideIcon
  iconSrc?: string
  items: readonly DashboardNavigationItem[]
}

export const overviewNavigation = {
  title: "Overview",
  url: "/dashboard",
  icon: LayoutDashboard,
} as const satisfies DashboardNavigationItem

export const dashboardNavigation = [
  {
    title: "Telegram",
    icon: UsersRound,
    iconSrc: telegramIcon,
    items: [
      { title: "Users", url: "/dashboard/telegram/users", icon: UsersRound },
      { title: "Groups", url: "/dashboard/telegram/groups", icon: Database },
      { title: "Access grants", url: "/dashboard/telegram/grants", icon: ShieldCheck },
    ],
  },
  {
    title: "Azure",
    icon: UsersRound,
    iconSrc: azureIcon,
    items: [{ title: "Members", url: "/dashboard/azure/members", icon: UsersRound }],
  },
  {
    title: "Web",
    icon: Globe,
    iconSrc: undefined,
    items: [{ title: "Guides", url: "/dashboard/web/guides", icon: BookOpen }],
  },
] as const satisfies readonly DashboardNavigationCategory[]

export const accountNavigation = {
  title: "Account",
  url: "/dashboard/account",
  icon: Settings,
} as const satisfies DashboardNavigationItem

type CategoryNavigationItem = (typeof dashboardNavigation)[number]["items"][number]

export type DashboardPath = typeof overviewNavigation.url | CategoryNavigationItem["url"] | typeof accountNavigation.url

const navigationEntries: [DashboardPath, string][] = [
  [overviewNavigation.url, overviewNavigation.title],
  [accountNavigation.url, accountNavigation.title],
]

for (const category of dashboardNavigation) {
  for (const item of category.items) navigationEntries.push([item.url, item.title])
}

export const DASHBOARD_NAV_MAP = new Map<DashboardPath, string>(navigationEntries)

export function isDashboardPath(path: string): path is DashboardPath {
  return DASHBOARD_NAV_MAP.has(path as DashboardPath)
}
