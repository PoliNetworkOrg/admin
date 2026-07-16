import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router"
import { ArrowRight, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AppMark } from "@/components/app-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth"
import { getCurrentSession, testBackend } from "@/server/api.functions"

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (await getCurrentSession()) throw redirect({ to: "/dashboard" })
  },
  component: Login,
})

function Login() {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const router = useRouter()

  async function sendCode() {
    setBusy(true)
    setNotice("")
    try {
      const { data, error } = await auth.emailOtp.sendVerificationOtp({ type: "sign-in", email: email.trim() })
      if (data?.success) setSent(true)
      else setNotice(error?.message ?? "We could not send a code. Check your email and try again.")
    } catch {
      setNotice("We could not reach the authentication service. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setNotice("")
    try {
      const { data, error } = await auth.signIn.emailOtp({ email: email.trim(), otp })
      if (data) await router.navigate({ to: "/dashboard" })
      else setNotice(error?.message ?? "That code is not valid. Please try again.")
    } catch {
      setNotice("We could not verify the code. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  async function passkey() {
    setBusy(true)
    setNotice("")
    try {
      const { data, error } = await auth.signIn.passkey()
      if (data) await router.navigate({ to: "/dashboard" })
      else setNotice(error?.message ?? "Passkey sign in was cancelled or unavailable.")
    } catch {
      setNotice("Passkey sign in is unavailable right now. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void testBackend().then((result) => {
      if (!result) toast.error("Backend is offline or unavailable")
    })
  }, [])

  return (
    <main className="grid min-h-dvh grid-cols-[minmax(320px,0.8fr)_minmax(480px,1.2fr)] bg-background max-[820px]:grid-cols-1">
      <section className="flex min-h-dvh flex-col bg-primary p-10 text-primary-foreground max-[820px]:hidden">
        <AppMark />
        <div className="my-auto max-w-md">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-primary-foreground/65 uppercase">
            Internal operations
          </p>
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
            <CardTitle className="text-2xl tracking-[-0.035em]">{sent ? "Check your inbox" : "Sign in"}</CardTitle>
            <CardDescription className="leading-5">
              {sent
                ? `Enter the six-digit code sent to ${email}.`
                : "Use your PoliNetwork email address or a saved passkey."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {notice && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {!sent ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendCode()
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email address</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@polinetwork.org"
                      required
                      autoComplete="email webauthn"
                    />
                    <FieldDescription>Use the address associated with your administrator account.</FieldDescription>
                  </Field>
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
                    ) : (
                      <Mail data-icon="inline-start" />
                    )}
                    Send one-time code
                    <ArrowRight data-icon="inline-end" className="ml-auto" />
                  </Button>
                </FieldGroup>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void verify()
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="otp">Six-digit code</FieldLabel>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      required
                      autoFocus
                    />
                  </Field>
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
                    ) : (
                      <ShieldCheck data-icon="inline-start" />
                    )}
                    Verify and continue
                  </Button>
                  <Button type="button" variant="link" className="w-max px-0" onClick={() => setSent(false)}>
                    Use another email
                  </Button>
                </FieldGroup>
              </form>
            )}
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" /> or <Separator className="flex-1" />
            </div>
            <Button variant="outline" size="lg" className="w-full" onClick={() => void passkey()} disabled={busy}>
              <KeyRound data-icon="inline-start" /> Continue with passkey
            </Button>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Need access?{" "}
              <Link className="font-medium text-primary hover:underline" to="/onboarding/link">
                Learn how access works
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
