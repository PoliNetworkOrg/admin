"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { FiChevronRight } from "react-icons/fi"
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
import { DSData } from "./data"

export function DSMainNav({ categoryState }: { categoryState: Record<string, boolean> }) {
  const [_, setCategoryState] = useCookieStorage<Record<string, boolean>>(
    COOKIES.SIDEBAR_CATEGORY_STATE,
    {},
    { expires: 60 * 60 * 24 * 7 }
  )

  return (
    <SidebarGroup>
      <SidebarMenu className="gap-2">
        {DSData.mainNav.map((category) => (
          <DSMenuCategory
            category={category}
            key={category.title}
            initialOpen={categoryState[category.title]}
            onPersistOpen={(open) => {
              setCategoryState((state) => ({ ...state, [category.title]: open }))
            }}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function DSMenuCategory({
  category,
  initialOpen,
  onPersistOpen,
}: {
  category: (typeof DSData)["mainNav"][0]
  initialOpen?: boolean
  onPersistOpen: (open: boolean) => void
}) {
  const pathname = usePathname()
  const categoryUrl = category.items[0]?.url.split("/").slice(0, 3).join("/")
  const [open, setOpen] = useState<boolean>(initialOpen ?? (categoryUrl ? pathname.startsWith(categoryUrl) : false))

  function handleOpenChange(open: boolean) {
    setOpen(open)
    onPersistOpen(open)
  }

  return (
    <Collapsible render={<SidebarMenuItem />} open={open} onOpenChange={handleOpenChange} className="group/collapsible">
      <CollapsibleTrigger
        render={
          <SidebarMenuButton className="font-medium">
            {category.icon}
            {category.title}
            <FiChevronRight className="ml-auto transition-transform ease-linear rotate-0 group-data-open/collapsible:rotate-90" />
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

  // NOTE: as of now, we have only 1 level depth of submenu, so using startsWith to
  // match also subroutes is ok.
  // If we go with multiple levels of depth it should be changed accordingly.
  const isActive = path.startsWith(item.url)

  return (
    <SidebarMenuSubItem key={item.title}>
      <SidebarMenuSubButton isActive={isActive} render={<Link href={item.url} />}>
        {item.icon}
        {item.title}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
