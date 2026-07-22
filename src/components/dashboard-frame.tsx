import { Outlet, useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { auth, useSession } from "@/lib/auth"
import type { AdminSession } from "@/server/api.functions"
import { ThemeToggle } from "./theme-toggle"

export function DashboardFrame({ initialSession }: { initialSession: AdminSession }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const sessionQuery = useSession()
  const liveSession = sessionQuery.data as AdminSession | null | undefined
  const session = liveSession === undefined ? initialSession : liveSession
  const user = session?.user

  useEffect(() => {
    const storedState = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("sidebar_state="))
      ?.split("=")[1]
    if (storedState === "false") setSidebarOpen(false)
  }, [])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      await router.invalidate()
      await router.navigate({ to: "/login", replace: true })
    } catch {
      toast.error("Could not sign out. Please try again.")
      setLoggingOut(false)
    }
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ "--sidebar-width": "16.25rem" } as React.CSSProperties}
    >
      <DashboardSidebar user={user} loggingOut={loggingOut} onLogout={() => void logout()} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/92 px-7 backdrop-blur-xl max-[640px]:px-4">
          <SidebarTrigger className="-ml-1" />
          <DashboardBreadcrumb className="min-w-0 flex-1" />
          <ThemeToggle />
        </header>
        <div className="mx-auto w-full max-w-[1440px] px-7 py-8 max-[640px]:px-4 max-[640px]:py-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
