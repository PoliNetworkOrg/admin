import {
  BookOpen,
  CircleCheck,
  CircleQuestionMark,
  Cloud,
  FilePenLine,
  Files,
  Flag,
  FolderKanban,
  FolderTree,
  Globe,
  HardDrive,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  MessagesSquare,
  MonitorDown,
  PenLine,
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
import type { Permission } from "@/server/permissions"

/** Every navigable dashboard route path, as TanStack `Link`'s `to` accepts it. */
export type DashboardPath = Extract<keyof FileRoutesByTo, `/dashboard${string}`>

export type ServiceId = "overview" | "telegram" | "whatsapp" | "m365" | "web" | "esign" | "reports" | "account"

export type Section = {
  id: string
  title: string
  icon: LucideIcon
  path: DashboardPath
  searchPlaceholder?: string
  /** The section reads `?q=` into its search, so the command palette can search it ("Find “…” in Telegram › Groups"). */
  queryable?: boolean
  permission?: Permission
  anyPermission?: readonly Permission[]
}

/**
 * `path` is where the service lands (its first section, or its own page for Overview and Account). `logo` is the
 * branded mark that replaces `icon` wherever the service is named (rail, panel, bottom nav, palette, Overview);
 * `icon` is the monochrome glyph of services without one. `short` is the label under it in the mobile bottom nav.
 */
export type Service = {
  id: ServiceId
  title: string
  short: string
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
  | { kind: "esign-inbox" }
  | { kind: "esign-requests" }
  | { kind: "esign-request"; id: string }
  | { kind: "esign-new" }
  | { kind: "esign-sign" }
  | { kind: "esign-drives" }
  | { kind: "esign-setup" }
  | { kind: "reports-open" }
  | { kind: "reports-closed" }
  | { kind: "not-found" }

export type PageKind = PageMatch["kind"]

const overview: Service = {
  id: "overview",
  title: "Overview",
  short: "Overview",
  icon: LayoutDashboard,
  path: "/dashboard",
  sections: [],
}
const account: Service = {
  id: "account",
  title: "Account",
  short: "Account",
  icon: UserRound,
  path: "/dashboard/account",
  sections: [],
}

const telegram: Service = {
  id: "telegram",
  title: "Telegram",
  short: "Telegram",
  icon: Send,
  logo: telegramLogo,
  path: "/dashboard/telegram/users",
  sections: [
    {
      id: "users",
      title: "Users",
      icon: UserRound,
      path: "/dashboard/telegram/users",
      permission: "tg:users:read",
      searchPlaceholder: "Search name, username or ID…",
      queryable: true,
    },
    {
      id: "groups",
      title: "Groups",
      icon: MessagesSquare,
      path: "/dashboard/telegram/groups",
      searchPlaceholder: "Search by group name or tag…",
      queryable: true,
    },
    {
      id: "grants",
      title: "Grants",
      icon: ShieldCheck,
      path: "/dashboard/telegram/grants",
      permission: "tg:grants:read",
      searchPlaceholder: "Search user, reason or grantor…",
    },
  ],
}

const whatsapp: Service = {
  id: "whatsapp",
  title: "WhatsApp",
  short: "WhatsApp",
  icon: MessageCircle,
  logo: whatsappLogo,
  path: "/dashboard/whatsapp/groups",
  sections: [
    {
      id: "groups",
      title: "Groups",
      icon: MessagesSquare,
      path: "/dashboard/whatsapp/groups",
      searchPlaceholder: "Search by group name…",
      queryable: true,
    },
  ],
}

const m365: Service = {
  id: "m365",
  title: "Microsoft 365",
  short: "M365",
  icon: Cloud,
  logo: azureLogo,
  path: "/dashboard/azure/groups",
  sections: [
    {
      id: "groups",
      title: "Groups",
      icon: UsersRound,
      path: "/dashboard/azure/groups",
      permission: "azure:groups:read",
      searchPlaceholder: "Search by group or email…",
    },
    {
      id: "members",
      title: "Members",
      icon: UserRound,
      path: "/dashboard/azure/members",
      anyPermission: ["azure:members:read", "azure:members:create"],
      searchPlaceholder: "Search name, email or ID…",
    },
  ],
}

const web: Service = {
  id: "web",
  title: "Web",
  short: "Web",
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
      searchPlaceholder: "Search labels…",
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

const esign: Service = {
  id: "esign",
  title: "Signatures",
  short: "Sign",
  icon: FilePenLine,
  path: "/dashboard/esign/inbox",
  sections: [
    {
      id: "inbox",
      title: "To sign",
      icon: PenLine,
      path: "/dashboard/esign/inbox",
      permission: "esign:sign",
      searchPlaceholder: "Search documents…",
    },
    {
      id: "requests",
      title: "Requests",
      icon: Files,
      path: "/dashboard/esign/requests",
      permission: "esign:sign",
      searchPlaceholder: "Search by title or signer…",
    },
    {
      id: "drives",
      title: "Drives",
      icon: HardDrive,
      path: "/dashboard/esign/drives",
      permission: "esign:drives:manage",
    },
    { id: "setup", title: "Setup", icon: MonitorDown, path: "/dashboard/esign/setup", permission: "esign:sign" },
  ],
}

const reports: Service = {
  id: "reports",
  title: "Reports",
  short: "Reports",
  icon: Flag,
  path: "/dashboard/reports/group-links",
  sections: [
    {
      id: "open",
      title: "Open",
      icon: Inbox,
      path: "/dashboard/reports/group-links",
      permission: "web:reports:manage",
      searchPlaceholder: "Search by group, label or link…",
    },
    {
      id: "closed",
      title: "Closed",
      icon: CircleCheck,
      path: "/dashboard/reports/resolved",
      permission: "web:reports:manage",
      searchPlaceholder: "Search by group, label or link…",
    },
  ],
}

/** Rail order: Overview (the logo), then the services with sections, then Account. */
export const services: Service[] = [overview, telegram, whatsapp, m365, web, esign, reports, account]

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

  if (head === "esign") {
    if (third === undefined) {
      if (second === "inbox") return { kind: "esign-inbox" }
      if (second === "requests") return { kind: "esign-requests" }
      if (second === "new") return { kind: "esign-new" }
      if (second === "sign") return { kind: "esign-sign" }
      if (second === "drives") return { kind: "esign-drives" }
      if (second === "setup") return { kind: "esign-setup" }
    }
    if (second === "requests" && third !== undefined && /^[0-9a-f-]{36}$/i.test(third)) {
      return { kind: "esign-request", id: third }
    }
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
    case "esign-inbox":
    case "esign-requests":
    case "esign-request":
    case "esign-new":
    case "esign-sign":
    case "esign-drives":
    case "esign-setup":
      return esign
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
    case "esign-inbox":
    case "esign-sign":
      return section(esign, "inbox")
    case "esign-requests":
    case "esign-request":
    case "esign-new":
      return section(esign, "requests")
    case "esign-drives":
      return section(esign, "drives")
    case "esign-setup":
      return section(esign, "setup")
    case "reports-open":
      return section(reports, "open")
    case "reports-closed":
      return section(reports, "closed")
  }
}

/** Deep pages are reached from a section but are not themselves in the panel. */
export function isDeepPage(match: PageMatch): boolean {
  return (
    match.kind === "telegram-user" ||
    match.kind === "web-category" ||
    match.kind === "web-tag" ||
    match.kind === "esign-request" ||
    match.kind === "esign-new" ||
    match.kind === "esign-sign"
  )
}

/** `document.title`: "{Section} - {Service} - PoliNetwork Admin", or "{Service} - PoliNetwork Admin". */
export function documentTitle(match: PageMatch): string {
  if (match.kind === "not-found") return "Page not found - PoliNetwork Admin"
  const service = serviceFor(match)
  const current = sectionFor(match)
  return current ? `${current.title} - ${service.title} - PoliNetwork Admin` : `${service.title} - PoliNetwork Admin`
}

/** Counts that mark a service and one of its sections: open reports, documents waiting for the user's signature. */
export type PendingCounts = { reports: Promise<number | null>; signatures: Promise<number | null> }

const NO_COUNT: Promise<number | null> = Promise.resolve(null)

/** The count behind a service's dot in the rail and bottom nav, if it has one. */
export function servicePending(
  id: ServiceId,
  pending: PendingCounts
): { count: Promise<number | null>; label: string } | null {
  if (id === "reports") return { count: pending.reports, label: "open reports" }
  if (id === "esign") return { count: pending.signatures, label: "documents to sign" }
  return null
}

/** The count next to a section in the panel, if it has one. */
export function sectionPending(
  serviceId: ServiceId,
  sectionId: string,
  pending: PendingCounts
): Promise<number | null> {
  if (serviceId === "reports" && sectionId === "open") return pending.reports
  if (serviceId === "esign" && sectionId === "inbox") return pending.signatures
  return NO_COUNT
}
