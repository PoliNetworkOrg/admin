import { cookies } from "next/headers"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { COOKIES } from "@/constants"
import { Breadcrumb } from "./breadcrumb"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIES.SIDEBAR_CATEGORY_STATE)?.value
  const DSCategoryState = cookie ? JSON.parse(cookie) : {}

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "19rem",
        } as React.CSSProperties
      }
    >
      <DashboardSidebar categoryState={DSCategoryState} />
      <SidebarInset className="px-4">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b mb-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
          <Breadcrumb />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
