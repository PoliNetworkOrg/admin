import { ArrowRight, CheckCircle2, Clock3, Copy, LoaderCircle, LogOut, MessageCircle, RotateCcw } from "lucide-react"

import { AppMark } from "@/components/app-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { AdminSession } from "@/lib/auth"

import { useTelegramLink } from "./use-telegram-link"

const botUsername = import.meta.env.PROD ? "pn_ts_dev_bot" : "pn_ts_devlocal_bot"

export function TelegramLinkPage({ initialSession }: { initialSession: AdminSession }) {
  const link = useTelegramLink(initialSession)

  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 max-[520px]:p-3">
      <header className="flex items-center justify-between">
        <AppMark />
        <ThemeToggle />
      </header>
      <Card className="m-auto w-full max-w-[500px] [--card-spacing:--spacing(6)]">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <MessageCircle className="size-5" />
          </span>
          <CardTitle className="text-2xl tracking-[-0.035em]">Link your Telegram account</CardTitle>
          <CardDescription className="leading-6">
            PoliNetwork uses your Telegram identity to check which administrative roles you can access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {link.notice && (
            <Alert variant={link.notice.kind === "error" ? "destructive" : "default"}>
              {link.notice.kind === "success" && <CheckCircle2 />}
              <AlertDescription>{link.notice.text}</AlertDescription>
            </Alert>
          )}

          {!link.ready ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="animate-spin-slow" /> Restoring link status…
            </div>
          ) : link.savedLink ? (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/40 p-5 text-center">
                <p className="text-xs font-medium text-muted-foreground">Link code for @{link.savedLink.username}</p>
                <button
                  type="button"
                  className="mt-3 rounded-lg px-3 py-2 font-mono text-3xl font-semibold tracking-[0.3em] outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                  onClick={() => void link.copyCode()}
                  aria-label={`Copy Telegram link code ${link.savedLink.code}`}
                >
                  {link.savedLink.code}
                </button>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" /> Expires in {formatRemaining(link.remainingSeconds)}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-full bg-primary transition-[width] duration-1000"
                    style={{ width: `${link.progress}%` }}
                  />
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                Open the PoliNetwork bot, send <code className="rounded bg-muted px-1.5 py-0.5 font-mono">/link</code>,
                then use the code above. This page checks the result automatically.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className={buttonVariants()}>
                  Open Telegram bot <ArrowRight data-icon="inline-end" />
                </a>
                <Button variant="outline" onClick={() => void link.copyCode()}>
                  <Copy data-icon="inline-start" /> Copy code
                </Button>
                <Button variant="ghost" onClick={link.resetLink}>
                  <RotateCcw data-icon="inline-start" /> Start over
                </Button>
              </div>
            </div>
          ) : link.phase === "verified" ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoaderCircle className="animate-spin-slow" /> Opening the dashboard…
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void link.startLink(event)}>
              <Field>
                <FieldLabel htmlFor="telegram-username">Telegram username</FieldLabel>
                <Input
                  id="telegram-username"
                  value={link.username}
                  onChange={(event) => link.setUsername(event.target.value.replaceAll("@", ""))}
                  placeholder="username"
                  autoComplete="off"
                  required
                  disabled={link.phase === "starting"}
                />
                <FieldDescription>Enter the username without the @ sign.</FieldDescription>
              </Field>
              <Button type="submit" disabled={link.phase === "starting" || !link.username.trim().replace(/^@+/, "")}>
                {link.phase === "starting" && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
                {link.phase === "expired" ? "Generate a new code" : "Generate link code"}
              </Button>
            </form>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <p className="min-w-0 truncate text-xs text-muted-foreground">Signed in as {link.session.user.email}</p>
            <Button variant="ghost" size="sm" onClick={() => void link.logout()} disabled={link.loggingOut}>
              {link.loggingOut ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
              ) : (
                <LogOut data-icon="inline-start" />
              )}
              Use another account
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}
