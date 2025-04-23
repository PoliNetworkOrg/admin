"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useState } from "react";

type MenuItem = {
  title: string;
  url?: string;
  icon?: LucideIcon;
  items?: {
    title: string;
    url?: string;
  }[];
};

export function NavMain({ items }: { items: MenuItem[] }) {
  const [activeMenu, setActiveMenu] = useState<string>("");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pages</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          item.items ? (
            <Collapsible
              key={item.title}
              asChild
              onOpenChange={(open) => setActiveMenu(open ? item.title : "")}
              open={item.title === activeMenu}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  {item.url ? (
                    <Link href={item.url} key={item.title}>
                      <SidebarMenuButton tooltip={item.title}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </Link>
                  ) : (
                    <SidebarMenuButton tooltip={item.title} disabled>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          {subItem.url ? (
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          ) : (
                            <span>{subItem.title}</span>
                          )}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : item.url ? (
            <Link
              href={item.url}
              key={item.title}
              onClick={() => setActiveMenu("")}
            >
              <SidebarMenuButton tooltip={item.title}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </Link>
          ) : (
            <SidebarMenuButton tooltip={item.title} disabled>
              {item.icon && <item.icon />}
              <span>{item.title}</span>
            </SidebarMenuButton>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
