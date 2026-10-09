import {
  BookOpen,
  CircleCheck,
  CircleQuestionMark,
  Cloud,
  Database,
  Flag,
  FolderKanban,
  FolderTree,
  Globe,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  Send,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react"

import azureLogo from "@/assets/svg/azure.svg"
import telegramLogo from "@/assets/svg/telegram.svg"
import whatsappLogo from "@/assets/svg/whatsapp.svg"
import { urlSegmentsToLabelPath } from "@/features/group-labels/label-tree"
import type { FileRoutesByTo } from "@/routeTree.gen"

/** Every navigable dashboard route path, as TanStack `Link`'s `to` accepts it. */
export type DashboardPath = Extract<keyof FileRoutesByTo, `/dashboard${string}`>

export type ServiceId = "overview" | "telegram" | "whatsapp" | "m365" | "web" | "reports" | "account"

export type Section = { id: string; title: string; icon: LucideIcon; path: DashboardPath; searchPlaceholder?: string }

/**
 * `path` is where the service lands (its first section, or its own page for Overview and Account). `logo` is the
 * branded mark that replaces `icon` wherever the service is named (rail, panel, sheet, overview, palette);
 * `icon` stays as the monochrome fallback.
 */
export type Service = {
  id: ServiceId
  title: string
  icon: LucideIcon
  logo?: string
  path: DashboardPath
  sections: Section[]
}

export type PageMatch =
  | { kind: "overview" }
  | { kind: "account" }
  | { kind: "telegram-users" }
  | { kind: "telegram-user"; userId: number }
  | { kind: "telegram-groups" }
  | { kind: "telegram-grants" }
  | { kind: "whatsapp-groups" }
  | { kind: "m365-groups" }
  | { kind: "m365-members" }
  | { kind: "web-projects" }
  | { kind: "web-associations" }
  | { kind: "web-guides" }
  | { kind: "web-faqs" }
  | { kind: "web-labels" }
  | { kind: "web-categories" }
  | { kind: "web-category"; path: string }
  | { kind: "web-tag"; tag: string }
  | { kind: "reports-open" }
  | { kind: "reports-closed" }
  | { kind: "not-found" }

export type PageKind = PageMatch["kind"]

const overview: Service = { id: "overview", title: "Overview", icon: LayoutDashboard, path: "/dashboard", sections: [] }
const account: Service = { id: "account", title: "Account", icon: UserRound, path: "/dashboard/account", sections: [] }

const telegram: Service = {
  id: "telegram",
  title: "Telegram",
  icon: Send,
  logo: telegramLogo,
  path: "/dashboard/telegram/users",
  sections: [
    {
      id: "users",
      title: "Users",
      icon: UsersRound,
      path: "/dashboard/telegram/users",
      searchPlaceholder: "Search by name or username…",
    },
    {
      id: "groups",
      title: "Groups",
      icon: Database,
      path: "/dashboard/telegram/groups",
      searchPlaceholder: "Search by group name or tag…",
    },
    {
      id: "grants",
      title: "Grants",
      icon: ShieldCheck,
      path: "/dashboard/telegram/grants",
      searchPlaceholder: "Search users, authorizers or reasons…",
    },
  ],
}

const whatsapp: Service = {
  id: "whatsapp",
  title: "WhatsApp",
  icon: MessageCircle,
  logo: whatsappLogo,
  path: "/dashboard/whatsapp/groups",
  sections: [
    {
      id: "groups",
      title: "Groups",
      icon: Database,
      path: "/dashboard/whatsapp/groups",
      searchPlaceholder: "Search by group name…",
    },
  ],
}

const m365: Service = {
  id: "m365",
  title: "Microsoft 365",
  icon: Cloud,
  logo: azureLogo,
  path: "/dashboard/azure/groups",
  sections: [
    {
      id: "groups",
      title: "Groups",
      icon: Database,
      path: "/dashboard/azure/groups",
      searchPlaceholder: "Search by group or email…",
    },
    {
      id: "members",
      title: "Members",
      icon: UsersRound,
      path: "/dashboard/azure/members",
      searchPlaceholder: "Search by name, email or member ID…",
    },
  ],
}

const web: Service = {
  id: "web",
  title: "Web",
  icon: Globe,
  path: "/dashboard/web/projects",
  sections: [
    { id: "projects", title: "Projects", icon: FolderKanban, path: "/dashboard/web/projects" },
    {
      id: "associations",
      title: "Associations",
      icon: Users,
      path: "/dashboard/web/associations",
      searchPlaceholder: "Search associations…",
    },
    {
      id: "guides",
      title: "Freshman guide",
      icon: BookOpen,
      path: "/dashboard/web/guides",
      searchPlaceholder: "Search by version…",
    },
    {
      id: "faqs",
      title: "FAQs",
      icon: CircleQuestionMark,
      path: "/dashboard/web/faqs",
      searchPlaceholder: "Search questions…",
    },
    {
      id: "labels",
      title: "Labels",
      icon: Tags,
      path: "/dashboard/web/group-labels",
      searchPlaceholder: "Search categories, attributes and publications…",
    },
    {
      id: "categories",
      title: "Categories",
      icon: FolderTree,
      path: "/dashboard/web/groups-by-label",
      searchPlaceholder: "Search by group name or tag…",
    },
  ],
}

const reports: Service = {
  id: "reports",
  title: "Reports",
  icon: Flag,
  path: "/dashboard/reports/group-links",
  sections: [
    {
      id: "open",
      title: "Open",
      icon: Inbox,
      path: "/dashboard/reports/group-links",
      searchPlaceholder: "Search by group, label or link…",
    },
    {
      id: "closed",
      title: "Closed",
      icon: CircleCheck,
      path: "/dashboard/reports/resolved",
      searchPlaceholder: "Search by group, label or link…",
    },
  ],
}

/** Rail order: Overview, then the five services with sections, then Account. */
export const services: Service[] = [overview, telegram, whatsapp, m365, web, reports, account]

/** The services that own a panel, in rail order. */
export const panelServices: Service[] = services.filter((service) => service.sections.length > 0)

export function serviceById(id: ServiceId): Service {
  return services.find((service) => service.id === id) ?? overview
}

function section(service: Service, id: string): Section | null {
  return service.sections.find((candidate) => candidate.id === id) ?? null
}

/** Matches a full pathname ("/dashboard/telegram/users/123"); anything outside `/dashboard` is not found. */
export function matchPath(pathname: string): PageMatch {
  const [root, ...segments] = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
  if (root !== "dashboard") return { kind: "not-found" }
  const [head, second, third, ...rest] = segments

  if (head === undefined) return { kind: "overview" }
  if (head === "account" && second === undefined) return { kind: "account" }

  // Category pages take the whole label path as their splat.
  if (head === "web" && second === "groups-by-label" && third !== undefined) {
    return { kind: "web-category", path: urlSegmentsToLabelPath([third, ...rest]) }
  }
  if (rest.length > 0) return { kind: "not-found" }

  if (head === "telegram") {
    if (second === "users" && third === undefined) return { kind: "telegram-users" }
    if (second === "users" && third !== undefined && /^\d+$/.test(third)) {
      return { kind: "telegram-user", userId: Number(third) }
    }
    if (second === "groups" && third === undefined) return { kind: "telegram-groups" }
    if (second === "grants" && third === undefined) return { kind: "telegram-grants" }
  }

  if (head === "whatsapp" && second === "groups" && third === undefined) return { kind: "whatsapp-groups" }

  if (head === "azure" && third === undefined) {
    if (second === "groups") return { kind: "m365-groups" }
    if (second === "members") return { kind: "m365-members" }
  }

  if (head === "web") {
    if (third === undefined) {
      if (second === "projects") return { kind: "web-projects" }
      if (second === "associations") return { kind: "web-associations" }
      if (second === "guides") return { kind: "web-guides" }
      if (second === "faqs") return { kind: "web-faqs" }
      if (second === "group-labels") return { kind: "web-labels" }
      if (second === "groups-by-label") return { kind: "web-categories" }
    }
    if (second === "tags" && third !== undefined) return { kind: "web-tag", tag: third }
  }

  if (head === "reports" && third === undefined) {
    if (second === "group-links") return { kind: "reports-open" }
    if (second === "resolved") return { kind: "reports-closed" }
  }

  return { kind: "not-found" }
}

export function serviceFor(match: PageMatch): Service {
  switch (match.kind) {
    case "overview":
    case "not-found":
      return overview
    case "account":
      return account
    case "telegram-users":
    case "telegram-user":
    case "telegram-groups":
    case "telegram-grants":
      return telegram
    case "whatsapp-groups":
      return whatsapp
    case "m365-groups":
    case "m365-members":
      return m365
    case "web-projects":
    case "web-associations":
    case "web-guides":
    case "web-faqs":
    case "web-labels":
    case "web-categories":
    case "web-category":
    case "web-tag":
      return web
    case "reports-open":
    case "reports-closed":
      return reports
  }
}

/** The panel section a page belongs to. Deep pages return their parent section (see `isDeepPage`). */
export function sectionFor(match: PageMatch): Section | null {
  switch (match.kind) {
    case "overview":
    case "account":
    case "not-found":
      return null
    case "telegram-users":
    case "telegram-user":
      return section(telegram, "users")
    case "telegram-groups":
      return section(telegram, "groups")
    case "telegram-grants":
      return section(telegram, "grants")
    case "whatsapp-groups":
      return section(whatsapp, "groups")
    case "m365-groups":
      return section(m365, "groups")
    case "m365-members":
      return section(m365, "members")
    case "web-projects":
      return section(web, "projects")
    case "web-associations":
      return section(web, "associations")
    case "web-guides":
      return section(web, "guides")
    case "web-faqs":
      return section(web, "faqs")
    case "web-labels":
    case "web-tag":
      return section(web, "labels")
    case "web-categories":
    case "web-category":
      return section(web, "categories")
    case "reports-open":
      return section(reports, "open")
    case "reports-closed":
      return section(reports, "closed")
  }
}

/** Deep pages are reached from a section but are not themselves in the panel. */
export function isDeepPage(match: PageMatch): boolean {
  return match.kind === "telegram-user" || match.kind === "web-category" || match.kind === "web-tag"
}

/** `document.title`: "{Section} · {Service} · PoliNetwork Admin", or "{Service} · PoliNetwork Admin". */
export function documentTitle(match: PageMatch): string {
  if (match.kind === "not-found") return "Page not found · PoliNetwork Admin"
  const service = serviceFor(match)
  const current = sectionFor(match)
  return current ? `${current.title} · ${service.title} · PoliNetwork Admin` : `${service.title} · PoliNetwork Admin`
}
