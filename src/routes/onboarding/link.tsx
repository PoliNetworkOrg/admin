import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, MessageCircle } from "lucide-react"
import { AppMark } from "@/components/app-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const Route = createFileRoute("/onboarding/link")({ component: LinkTelegram })

function LinkTelegram() {
  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 max-[520px]:p-3">
      <header className="flex items-center justify-between">
        <AppMark />
        <ThemeToggle />
      </header>
      <Card className="m-auto w-full max-w-[460px] [--card-spacing:--spacing(6)]">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <MessageCircle className="size-5" />
          </span>
          <CardTitle className="text-2xl tracking-[-0.035em]">Telegram access</CardTitle>
          <CardDescription className="leading-6">
            Your Telegram identity is used to verify the administrative roles that unlock this workspace. If your
            account is not linked yet, contact a PoliNetwork administrator before signing in again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/login" />} nativeButton={false}>
            <ArrowLeft data-icon="inline-start" /> Back to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
