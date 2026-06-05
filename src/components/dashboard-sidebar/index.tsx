"use client"

import Link from "next/link"
import type * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Logo } from "../logo"
import { DSMainNav } from "./main-nav"
import { DSUserNav } from "./user-nav"

export function DashboardSidebar({
  categoryState,
  ...props
}: React.ComponentProps<typeof Sidebar> & { categoryState: Record<string, boolean> }) {
  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <Logo />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">PoliNetwork APS</span>
                <span className="truncate text-xs">Admin Dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <DSMainNav categoryState={categoryState} />
      </SidebarContent>
      <SidebarFooter>
        <DSUserNav />
      </SidebarFooter>
    </Sidebar>
  )
}
