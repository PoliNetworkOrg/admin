import { createFileRoute, redirect } from "@tanstack/react-router"
import { ExternalLink, LogOut, ShieldX } from "lucide-react"
import { useState } from "react"

import { AppMark } from "@/components/app-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardAccess, getIdpAccountUrl } from "@/features/auth/auth.functions"
import { signInRedirect } from "@/lib/sign-in"
import { submitSignOut } from "@/lib/sign-out"

export const Route = createFileRoute("/unauthorized")({
  beforeLoad: async () => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw signInRedirect()
    if (access.status === "authorized") throw redirect({ to: "/dashboard" })
    return { user: access.user, stale: access.stale }
  },
  loader: () => getIdpAccountUrl(),
  component: Unauthorized,
})

function Unauthorized() {
  const { user, stale } = Route.useRouteContext()
  const accountUrl = Route.useLoaderData()
  const [pending, setPending] = useState(false)

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
          <CardTitle className="text-2xl tracking-[-0.035em]">
            {stale ? "Permissions are temporarily unavailable" : "Administrator access required"}
          </CardTitle>
          <CardDescription className="leading-6">
            {stale
              ? "The dashboard can't confirm your permissions right now. Try again in a few minutes."
              : "Your PoliNetwork account does not have dashboard access. Contact an IT administrator if this is unexpected."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Signed in as {user.email || user.name}</p>
          <div className="flex flex-wrap gap-2">
            <a href={accountUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
              <ExternalLink data-icon="inline-start" /> PoliNetwork Auth
            </a>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                setPending(true)
                submitSignOut()
              }}
            >
              <LogOut data-icon="inline-start" /> Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
