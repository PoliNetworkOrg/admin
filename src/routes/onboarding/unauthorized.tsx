import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { LogOut, ShieldX } from "lucide-react"
import { useState } from "react"
import { AppMark } from "@/components/app-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardAccess } from "@/features/auth/auth.functions"
import { auth } from "@/lib/auth"

export const Route = createFileRoute("/onboarding/unauthorized")({
  beforeLoad: async () => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw redirect({ to: "/login" })
    if (access.status === "telegram-unlinked") throw redirect({ to: "/onboarding/link" })
    if (access.status === "authorized") throw redirect({ to: "/dashboard" })
    return { session: access.session }
  },
  component: Unauthorized,
})

function Unauthorized() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    setError("")
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      await router.invalidate()
      await router.navigate({ to: "/login", replace: true })
    } catch (error) {
      console.error(error)
      setError("Could not sign out. Please try again.")
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 max-[520px]:p-3">
      <header className="flex items-center justify-between">
        <AppMark />
        <ThemeToggle />
      </header>
      <Card className="m-auto w-full max-w-[460px] [--card-spacing:--spacing(6)]">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-lg bg-accent text-destructive">
            <ShieldX className="size-5" />
          </span>
          <CardTitle className="text-2xl tracking-[-0.035em]">Administrator access required</CardTitle>
          <CardDescription className="leading-6">
            Your Telegram account is linked, but it does not have a PoliNetwork dashboard administrator role. Contact an
            IT administrator if this is unexpected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">Signed in as {session.user.email}</p>
          <Button variant="outline" onClick={() => void logout()} disabled={pending}>
            <LogOut data-icon="inline-start" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
