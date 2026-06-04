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
import { DSData } from "./data"

export function DSMainNav() {
  return (
    <SidebarGroup>
      <SidebarMenu className="gap-2">
        {DSData.mainNav.map((category) => (
          <SidebarMenuItem key={category.title}>
            <SidebarMenuButton render={<a href={category.url} className="font-medium" />}>
              {category.title}
            </SidebarMenuButton>
            {category.items?.length ? (
              <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                {category.items.map((item) => (
                  <DSMenuItem key={item.url === "#" ? item.title : item.url} item={item} />
                ))}
              </SidebarMenuSub>
            ) : null}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function DSMenuItem({ item }: { item: (typeof DSData)["mainNav"][0]["items"][0] }) {
  const path = usePathname()
  const isActive = path === item.url

  return (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton isActive={isActive} render={<a href={item.url} />}>
        {item.title}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
