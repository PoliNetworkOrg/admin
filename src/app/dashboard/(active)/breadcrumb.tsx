"use client"
import { usePathname } from "next/navigation"
import { Fragment, useMemo } from "react"
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getBreadcrumbs } from "@/components/dashboard-sidebar/main-nav"

export function Breadcrumb() {
  const pathname = usePathname()
  const items = useMemo(() => getBreadcrumbs(pathname), [pathname])

  return (
    <BreadcrumbRoot>
      <BreadcrumbList>
        {items.map((item, i) => (
          <Fragment key={`breadcrumb-item-${i}`}>
            <BreadcrumbItem className="hidden md:block">
              {i === items.length - 1 ? (
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
              ) : item.url ? (
                <BreadcrumbLink href={item.url}>{item.title}</BreadcrumbLink>
              ) : (
                item.title
              )}
            </BreadcrumbItem>
            {i < items.length - 1 && <BreadcrumbSeparator className="hidden md:block" />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </BreadcrumbRoot>
  )
}
