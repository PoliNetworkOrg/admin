"use client"
import { ChevronRight } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
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
          <DSMenuCategory category={category} key={category.title} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function DSMenuCategory({ category }: { category: (typeof DSData)["mainNav"][0] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(pathname.startsWith(category.url))
  }, [])

  return (
    <Collapsible render={<SidebarMenuItem />} open={open} onOpenChange={setOpen} className="group/collapsible">
      <CollapsibleTrigger
        render={
          <SidebarMenuButton className="font-medium">
            {category.icon}
            {category.title}
            <ChevronRight className="ml-auto transition-transform ease-linear rotate-0 group-data-open/collapsible:rotate-90" />
          </SidebarMenuButton>
        }
      />
      <CollapsibleContent>
        {category.items?.length ? (
          <SidebarMenuSub className="px-1.5">
            {category.items.map((item) => (
              <DSMenuItem key={item.url === "#" ? item.title : item.url} item={item} />
            ))}
          </SidebarMenuSub>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
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
