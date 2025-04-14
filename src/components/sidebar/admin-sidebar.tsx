"use client";

import { Compass, Home, Settings2, Users, Wrench } from "lucide-react";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { User } from "better-auth";

const data = {
  navMain: [
    {
      title: "Home",
      url: "/dashboard",
      icon: Home,
    },
    {
      title: "HR",
      url: "/dashboard/hr",
      icon: Users,
      isActive: true,
      items: [
        {
          title: "Users",
          url: "/dashboard/hr/users",
        },
        {
          title: "Admins",
          url: "/dashboard/hr/dashboards",
        },
      ],
    },
    {
      title: "Management",
      url: "/dashboard/management",
      icon: Wrench,
      items: [],
    },
    {
      title: "Website Data",
      url: "/dashboard/website",
      icon: Compass,
      items: [
        {
          title: "TG Users",
          url: "/dashboard/website/tg-users",
        },
        {
          title: "Groups",
          url: "/dashboard/website/groups",
        },
        {
          title: "Info",
          url: "/dashboard/website/info",
        },
      ],
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/dashboard/settings/general",
        },
      ],
    },
  ],
};

export function AdminSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: User;
}) {
  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="top-[--header-height] pb-[--header-height]"
      {...props}
    >
      <SidebarHeader>
        <div className="flex items-center justify-start gap-2">
          <SidebarTrigger className="h-8 w-8" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>{" "}
      <SidebarRail />
    </Sidebar>
  );
}
