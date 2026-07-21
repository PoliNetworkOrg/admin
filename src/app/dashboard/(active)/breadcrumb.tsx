"use client"
import { usePathname } from "next/navigation"
import { Fragment, useMemo } from "react"
import { NAV_MAP } from "@/components/dashboard-sidebar/data"
import {
  BreadcrumbItem as BreadcrumbItemComponent,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export type BreadcrumbItem = {
  title: string
  url?: string
}

export function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  const pathname = usePathname()
  const items = useMemo(() => getBreadcrumbs(NAV_MAP, pathname), [pathname])

  return (
    <BreadcrumbRoot className={className} {...props}>
      <BreadcrumbList>
        {items.map((item, i) => (
          <Fragment key={`breadcrumb-item-${i}`}>
            <BreadcrumbItemComponent className="hidden md:block">
              {i === items.length - 1 ? (
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
              ) : item.url ? (
                <BreadcrumbLink href={item.url}>{item.title}</BreadcrumbLink>
              ) : (
                item.title
              )}
            </BreadcrumbItemComponent>
            {i < items.length - 1 && <BreadcrumbSeparator className="hidden md:block" />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </BreadcrumbRoot>
  )
}

function getBreadcrumbs(navMap: Map<string, string>, pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  let currentPath = ""
  let i = 0

  for (const segment of segments) {
    currentPath += `/${segment}`
    let title = navMap.get(currentPath)
    if (!title) {
      if (isUUIDorId(segment)) {
        title = "Details"
      } else {
        title = segment.charAt(0).toUpperCase() + segment.slice(1)
      }
    }

    // note: at the moment we do not plan to make category pages.
    // If such pages are made in the future, this logic can be removed
    breadcrumbs.push({ title, url: i !== 1 ? currentPath : undefined })
    i++
  }

  return breadcrumbs
}

function isUUIDorId(segment: string) {
  return !Number.isNaN(Number(segment)) || segment.length > 20 // Regex custom a seconda dei tuoi ID
}
