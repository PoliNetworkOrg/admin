import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react"
import { useState } from "react"
import logoUrl from "@/assets/logo.png"
import { AppMark } from "@/components/app-mark"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { auth } from "@/lib/auth"

export const Route = createFileRoute("/login")({ component: Login })

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
    const { data, error } = await auth.emailOtp.sendVerificationOtp({ type: "sign-in", email })
    setBusy(false)
    if (data?.success) setSent(true)
    else setNotice(error?.message ?? "We could not send a code. Check your email and try again.")
  }

  async function verify() {
    setBusy(true)
    setNotice("")
    const { data, error } = await auth.signIn.emailOtp({ email, otp })
    setBusy(false)
    if (data) router.navigate({ to: "/dashboard" })
    else setNotice(error?.message ?? "That code is not valid. Please try again.")
  }

  async function passkey() {
    setBusy(true)
    setNotice("")
    const { data, error } = await auth.signIn.passkey()
    setBusy(false)
    if (data) router.navigate({ to: "/dashboard" })
    else setNotice(error?.message ?? "Passkey sign in was cancelled or unavailable.")
  }

  return (
    <main className="flex min-h-screen flex-col bg-sidebar px-[max(5vw,38px)] pt-7 pb-[18px] text-[#f5f5ec] max-[600px]:px-[25px]">
      <header className="relative z-10 flex items-center justify-between">
        <AppMark />
        <span className="font-mono text-[10px] text-[#9cad9f] max-[600px]:hidden">Internal workspace</span>
      </header>
      <div className="mx-auto my-auto grid w-full max-w-[1110px] grid-cols-[1.15fr_0.85fr] items-center gap-[90px] py-10 max-[900px]:gap-12 max-[900px]:grid-cols-1 max-[900px]:py-[30px]">
        <section>
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-sidebar-primary">
            POLINETWORK ADMIN
          </p>
          <h1 className="mt-[17px] font-serif text-[clamp(43px,5.2vw,73px)] leading-[1.04] tracking-[-0.07em]">
            The work behind
            <br />
            <i className="text-sidebar-primary">the network.</i>
          </h1>
          <p className="mt-[17px] max-w-[430px] text-sm leading-[1.6] text-[#b8c5ba]">
            One protected workspace for association members, Telegram communities and the systems that connect them.
          </p>
          <div className="mt-7 flex flex-wrap gap-[15px] text-[10px] text-[#d5e5f8] max-[600px]:grid max-[600px]:gap-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="text-sidebar-primary" /> Role-aware access
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="text-sidebar-primary" /> Passkey-ready sign in
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="text-sidebar-primary" /> Auditable operations
            </span>
          </div>
          <div
            className="relative mt-[45px] grid h-[120px] w-[220px] place-items-center text-sidebar-primary max-[900px]:hidden"
            aria-hidden="true"
          >
            <img
              className="relative z-10 size-[104px] rounded-full shadow-[0_0_0_10px_rgba(17,86,174,0.15)]"
              src={logoUrl}
              alt=""
            />
            <span className="absolute size-[115px] rounded-full border border-sidebar-primary/50" />
            <span className="absolute size-[184px] rounded-full border border-dashed border-sidebar-primary/50" />
            <span className="absolute top-1 right-[17px] size-[11px] rounded-full bg-[#d86b3f]" />
          </div>
        </section>
        <section className="bg-background p-[34px] text-foreground shadow-[10px_10px_0_rgba(55,126,215,0.42)] max-[600px]:p-[27px_23px] max-[600px]:shadow-[6px_6px_0_rgba(55,126,215,0.42)]">
          <div>
            <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
              SECURE ACCESS
            </p>
            <h2 className="mt-2 font-serif text-[28px] leading-tight tracking-[-0.06em]">
              {sent ? "Check your inbox" : "Welcome back"}
            </h2>
            <p className="mt-2 text-xs leading-[1.5] text-muted-foreground">
              {sent ? `We sent a six-digit code to ${email}.` : "Use your PoliNetwork email or a saved passkey."}
            </p>
          </div>
          {!sent ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void sendCode()
              }}
            >
              <FieldGroup className="mt-7 gap-3.5">
                <Field>
                  <FieldLabel htmlFor="email" className="font-mono text-[10px] font-medium text-[#53635e]">
                    Email address
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    className="h-[42px] rounded-none border-[#cbd0c7] bg-[#fffefa] px-2.5 text-[13px] text-foreground shadow-none outline-primary focus-visible:ring-0"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@polinetwork.org"
                    required
                    autoComplete="email webauthn"
                  />
                </Field>
                <Button
                  type="submit"
                  className="h-[42px] w-full justify-start rounded-none bg-primary px-3 text-[11px] font-semibold hover:bg-primary/85"
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
                  ) : (
                    <Mail data-icon="inline-start" />
                  )}{" "}
                  Send one-time code <ArrowRight data-icon="inline-end" className="ml-auto" />
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
              <FieldGroup className="mt-7 gap-3.5">
                <Field>
                  <FieldLabel htmlFor="otp" className="font-mono text-[10px] font-medium text-[#53635e]">
                    Six-digit code
                  </FieldLabel>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="h-[42px] rounded-none border-[#cbd0c7] bg-[#fffefa] px-2.5 text-[13px] text-foreground shadow-none outline-primary focus-visible:ring-0"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  className="h-[42px] w-full justify-start rounded-none bg-primary px-3 text-[11px] font-semibold hover:bg-primary/85"
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
                  ) : (
                    <ShieldCheck data-icon="inline-start" />
                  )}{" "}
                  Verify & continue <ArrowRight data-icon="inline-end" className="ml-auto" />
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto w-max rounded-none px-0 py-1 text-[11px] text-primary"
                  onClick={() => setSent(false)}
                >
                  Use another email
                </Button>
              </FieldGroup>
            </form>
          )}
          <div className="my-5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="secondary"
            className="h-[42px] w-full rounded-none bg-[#e5e9df] text-[11px] text-foreground hover:bg-[#dbe1d4]"
            onClick={() => void passkey()}
            disabled={busy}
          >
            <KeyRound data-icon="inline-start" /> Continue with passkey
          </Button>
          {notice && <p className="mt-3 text-[10px] leading-[1.5] text-[#a8442c]">{notice}</p>}
          <p className="mt-5 text-[9px] text-muted-foreground">
            Need access? Contact an existing PoliNetwork administrator.
          </p>
        </section>
      </div>
      <footer className="relative z-10 flex items-center justify-between font-mono text-[10px] text-[#9cad9f]">
        <span>© PoliNetwork APS</span>
        <Link className="text-sidebar-primary" to="/onboarding/link">
          How access works
        </Link>
      </footer>
    </main>
  )
}
