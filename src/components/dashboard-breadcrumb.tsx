import { Link, useRouterState } from "@tanstack/react-router"
import { Fragment, useMemo } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { DASHBOARD_NAV_MAP, type DashboardPath, isDashboardPath } from "./dashboard-navigation"

type DashboardBreadcrumbItem = {
  title: string
  url?: DashboardPath
}

export function DashboardBreadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const items = useMemo(() => getBreadcrumbs(pathname), [pathname])

  return (
    <Breadcrumb className={className} {...props}>
      <BreadcrumbList className="flex-nowrap">
        {items.map((item, index) => {
          const current = index === items.length - 1

          return (
            <Fragment key={`${item.title}-${index}`}>
              <BreadcrumbItem className={current ? undefined : "hidden md:inline-flex"}>
                {current ? (
                  <BreadcrumbPage className="truncate font-medium">{item.title}</BreadcrumbPage>
                ) : item.url ? (
                  <BreadcrumbLink render={<Link to={item.url} />}>{item.title}</BreadcrumbLink>
                ) : (
                  <span>{item.title}</span>
                )}
              </BreadcrumbItem>
              {!current && <BreadcrumbSeparator className="hidden md:list-item" />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function getBreadcrumbs(pathname: string): DashboardBreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: DashboardBreadcrumbItem[] = []
  let currentPath = ""

  for (const [index, segment] of segments.entries()) {
    currentPath += `/${segment}`
    const mappedTitle = isDashboardPath(currentPath) ? DASHBOARD_NAV_MAP.get(currentPath) : undefined
    const title = mappedTitle ?? (isIdentifier(segment) ? "Details" : formatSegment(segment))

    breadcrumbs.push({
      title,
      // Service categories are organizational labels rather than destinations.
      url: index !== 1 && isDashboardPath(currentPath) ? currentPath : undefined,
    })
  }

  return breadcrumbs
}

function formatSegment(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function isIdentifier(segment: string) {
  return /^\d+$/.test(segment) || segment.length > 20
}
