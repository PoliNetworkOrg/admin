import { cookies } from "next/headers"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { COOKIES } from "@/constants"
import { Breadcrumb } from "./breadcrumb"

function parseCookie(cookie: string) {
  try {
    const parsed = JSON.parse(cookie)
    return parsed
  } catch (_e) {
    return {}
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIES.SIDEBAR_CATEGORY_STATE)?.value
  const DSCategoryState = cookie ? parseCookie(cookie) : {}

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
        <header className="flex h-16 shrink-0 relative items-center justify-between gap-2 border-b mb-8">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb className="absolute left-1/2 -translate-x-1/2" />
          <div></div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
// <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
