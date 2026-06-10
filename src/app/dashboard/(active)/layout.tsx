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
  const sidebarCookies = await getSidebarCookies()

  return (
    <SidebarProvider
      defaultOpen={sidebarCookies.open}
      style={
        {
          "--sidebar-width": "19rem",
        } as React.CSSProperties
      }
    >
      <DashboardSidebar categoryState={sidebarCookies.state} />
      <SidebarInset className="px-4">
        <header className="flex h-16 shrink-0 relative items-center justify-between gap-2 border-b mb-8">
          <SidebarTrigger className="-ml-1" size="icon" />
          <Breadcrumb className="absolute left-1/2 -translate-x-1/2" />
          <div></div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}

async function getSidebarCookies() {
  const cookieStore = await cookies()

  const sidebarCategoryStateCookie = cookieStore.get(COOKIES.SIDEBAR_CATEGORY_STATE)?.value
  const sidebarOpenCookie = cookieStore.get(COOKIES.SIDEBAR_OPEN)?.value
  const state: Record<string, boolean> = sidebarCategoryStateCookie ? parseCookie(sidebarCategoryStateCookie) : {}
  const open: boolean = sidebarOpenCookie !== undefined ? parseCookie(sidebarOpenCookie) : true

  return { state, open }
}
