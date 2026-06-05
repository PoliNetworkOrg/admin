"use client"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { COOKIES } from "@/constants"
import { useCookieStorage } from "@/hooks/use-cookie-storage"
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
import { Skeleton } from "../ui/skeleton"
import { DSData } from "./data"

export function DSMainNav({ categoryState }: { categoryState: Record<string, boolean> }) {
  return (
    <SidebarGroup>
      <SidebarMenu className="gap-2">
        {DSData.mainNav.map((category) => (
          <DSMenuCategory category={category} key={category.title} initialOpen={categoryState[category.title]} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function DSMenuCategory({ category, initialOpen }: { category: (typeof DSData)["mainNav"][0]; initialOpen?: boolean }) {
  const pathname = usePathname()
  const categoryUrl = category.items[0]?.url.split("/").slice(0, 3).join("/")
  const [open, setOpen] = useState<boolean>(initialOpen ?? (categoryUrl ? pathname.startsWith(categoryUrl) : false))
  const [_, setState] = useCookieStorage<Record<string, boolean>>(
    COOKIES.SIDEBAR_CATEGORY_STATE,
    {},
    { expires: 60 * 60 * 24 * 7 }
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open)
      setState((state) => {
        state[category.title] = open
        return state
      })
    },
    [setState, category.title]
  )

  return open !== undefined ? (
    <Collapsible render={<SidebarMenuItem />} open={open} onOpenChange={handleOpenChange} className="group/collapsible">
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
  ) : (
    <Skeleton />
  )
}

function DSMenuItem({ item }: { item: (typeof DSData)["mainNav"][0]["items"][0] }) {
  const path = usePathname()
  const isActive = path === item.url

  return (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton isActive={isActive} render={<Link href={item.url} />}>
        {item.icon}
        {item.title}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
