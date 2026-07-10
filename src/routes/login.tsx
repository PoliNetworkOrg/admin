import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ArrowRight, CheckCircle2, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react"
import { useState } from "react"
import logoUrl from "@/assets/logo.png"
import { AppMark } from "@/components/app-mark"
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
    <main className="login-page">
      <header>
        <AppMark />
        <span>Internal workspace</span>
      </header>
      <div className="login-layout">
        <section className="login-copy">
          <p className="eyebrow">POLINETWORK ADMIN</p>
          <h1>
            The work behind
            <br />
            <i>the network.</i>
          </h1>
          <p>
            One protected workspace for association members, Telegram communities and the systems that connect them.
          </p>
          <div className="login-promises">
            <span>
              <CheckCircle2 size={16} /> Role-aware access
            </span>
            <span>
              <CheckCircle2 size={16} /> Passkey-ready sign in
            </span>
            <span>
              <CheckCircle2 size={16} /> Auditable operations
            </span>
          </div>
          <div className="login-art">
            <img src={logoUrl} alt="" />
            <span className="art-ring one" />
            <span className="art-ring two" />
            <span className="art-dot" />
          </div>
        </section>
        <section className="login-card">
          <div>
            <p className="eyebrow">SECURE ACCESS</p>
            <h2>{sent ? "Check your inbox" : "Welcome back"}</h2>
            <p>{sent ? `We sent a six-digit code to ${email}.` : "Use your PoliNetwork email or a saved passkey."}</p>
          </div>
          {!sent ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void sendCode()
              }}
            >
              <label>
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@polinetwork.org"
                  required
                  autoComplete="email webauthn"
                />
              </label>
              <button className="login-button" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <Mail size={17} />} Send one-time code{" "}
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void verify()
              }}
            >
              <label>
                Six-digit code
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  required
                />
              </label>
              <button className="login-button" disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} Verify & continue{" "}
                <ArrowRight size={16} />
              </button>
              <button type="button" className="text-button" onClick={() => setSent(false)}>
                Use another email
              </button>
            </form>
          )}
          <div className="or">
            <span />
            or
            <span />
          </div>
          <button className="passkey-button" onClick={() => void passkey()} disabled={busy}>
            <KeyRound size={17} /> Continue with passkey
          </button>
          {notice && <p className="form-notice">{notice}</p>}
          <p className="access-note">Need access? Contact an existing PoliNetwork administrator.</p>
        </section>
      </div>
      <footer>
        <span>© PoliNetwork APS</span>
        <Link to="/onboarding/link">How access works</Link>
      </footer>
    </main>
  )
}
