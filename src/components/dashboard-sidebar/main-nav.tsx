"use client"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar"
import { DSData, navMap } from "./data"

export type BreadcrumbItem = {
  title: string
  url?: string
}

console.log(navMap)
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  let currentPath = ""

  for (const segment of segments) {
    currentPath += `/${segment}`
    let title = navMap[currentPath]
    if (!title) {
      if (isUUIDorId(segment)) {
        title = "Details"
      } else {
        title = segment.charAt(0).toUpperCase() + segment.slice(1)
      }
    }

    breadcrumbs.push({ title, url: currentPath })
  }

  return breadcrumbs
}

function isUUIDorId(segment: string) {
  return !isNaN(Number(segment)) || segment.length > 20 // Regex custom a seconda dei tuoi ID
}

export function DSMainNav() {
  return (
    <SidebarGroup>
      <SidebarMenu className="gap-2">
        {DSData.navMain.map((category) => (
          <SidebarMenuItem key={category.title}>
            <SidebarMenuButton render={<a href={category.url} className="font-medium" />}>
              {category.title}
            </SidebarMenuButton>
            {category.items?.length ? (
              <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                {category.items.map((item) => (
                  <DSMenuItem key={item.url === "#" ? item.title : item.url} parent={category} item={item} />
                ))}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function DSMenuItem({
  parent,
  item,
}: {
  parent: (typeof DSData)["navMain"][0]
  item: (typeof DSData)["navMain"][0]["items"][0]
}) {
  const path = usePathname()
  // const { setBreadcrumb } = useSidebar()
  const isActive = path === item.url

  // useEffect(() => {
  //   if (isActive) {
  //     setBreadcrumb([
  //       { title: parent.title, url: parent.url },
  //       { title: item.title, url: item.url },
  //     ])
  //   }
  // }, [isActive])

  return (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton isActive={isActive} render={<a href={item.url} />}>
        {item.title}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
