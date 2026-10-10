import { ArrowRight } from "lucide-react"

import { AppMark } from "@/components/app-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const errorMessages = new Map([
  ["missing-state", "The sign-in took too long or was started in another tab. Sign in again."],
  ["state-mismatch", "The sign-in took too long or was started in another tab. Sign in again."],
  ["denied", "Sign-in was cancelled or refused by PoliNetwork Auth."],
  ["exchange-failed", "PoliNetwork Auth could not complete the sign-in. Try again."],
])

/** Sign-in happens at PoliNetwork Auth; this page is where sign-out and failed sign-ins land. */
export function LoginPage({ error }: { error: string | undefined }) {
  const notice = error ? (errorMessages.get(error) ?? "The sign-in failed. Try again.") : null

  return (
    <main className="grid min-h-dvh grid-cols-[minmax(320px,0.8fr)_minmax(480px,1.2fr)] bg-background max-[820px]:grid-cols-1">
      <section className="flex min-h-dvh flex-col bg-primary p-10 text-primary-foreground max-[820px]:hidden">
        <AppMark />
        <div className="my-auto max-w-md">
          <p className="text-xs font-semibold text-primary-foreground/65">Internal operations</p>
          <h1 className="mt-4 text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.065em]">
            The work behind the network.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/72">
            Protected access for managing association members, Telegram communities and administrative permissions.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© PoliNetwork APS</p>
      </section>

      <section className="flex min-h-dvh flex-col p-6 max-[520px]:p-3">
        <header className="flex items-center justify-between min-[821px]:justify-end">
          <span className="min-[821px]:hidden">
            <AppMark />
          </span>
          <ThemeToggle />
        </header>
        <Card className="m-auto w-full max-w-[440px] [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-2xl tracking-[-0.035em]">Sign in</CardTitle>
            <CardDescription className="leading-5">
              Use your PoliNetwork account. Access depends on the permissions it holds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {notice && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {/* A document navigation: `/auth/login` is a server route that redirects to the IdP. */}
            <a href="/auth/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
              Continue with PoliNetwork
              <ArrowRight data-icon="inline-end" className="ml-auto" />
            </a>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
