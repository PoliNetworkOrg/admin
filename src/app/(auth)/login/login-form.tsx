"use client"

import { Key, Loader2, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/auth"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      {!sent ? (
        <EmailCard email={email} onChange={(v) => setEmail(v)} onSend={() => setSent(true)} />
      ) : (
        <OTPCard email={email} />
      )}
    </div>
  )
  // <FieldSeparator>Or continue with</FieldSeparator>
  // <Button onClick={loginWithPasskey} className="w-full"><KeyRound size={16} /> Login with Passkey</Button>
}

function EmailCard({
  email,
  onChange,
  onSend,
}: {
  email: string
  onChange: (value: string) => void
  onSend: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const router = useRouter()

  async function sendOtp() {
    const { data, error } = await auth.emailOtp.sendVerificationOtp({
      type: "sign-in",
      email,
    })

    if (data?.success) {
      onSend()
      toast.success("OTP sent. Check your inbox and spam!")
      return
    }

    if (error?.code === "INVALID_EMAIL") {
      toast.error("Invalid email")
      return
    }

    toast.error("There was an unexpected error")
    console.error({ error })
  }

  async function passkeyLogin() {
    setPasskeyLoading(true)
    const { data, error } = await auth.signIn.passkey()
    if (error || !data) toast.error("Unable to login with passkey")
    else {
      toast.success("Login successful")
      router.replace("/dashboard")
    }
    setPasskeyLoading(false)
  }

  return (
    <div className="w-full flex flex-col gap-8">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setLoading(true)
          await sendOtp()
          setLoading(false)
        }}
      >
        <div className="flex gap-2 flex-col items-start justify-start">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="mario.rossi@example.org"
            className="bg-card w-auto"
            required
            onChange={(e) => {
              onChange(e.target.value)
            }}
            value={email}
            autoComplete="email webauthn"
          />
        </div>
        <Button type="submit" disabled={loading} className="basis-9 group">
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              <Mail size={16} />
              Login with OTP
            </>
          )}
        </Button>
      </form>
      <FieldSeparator>Or continue with</FieldSeparator>
      <Button onClick={passkeyLogin} disabled={passkeyLoading} className="basis-9 group" variant="secondary">
        {passkeyLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <Key size={16} /> Login with Passkey
          </>
        )}
      </Button>
    </div>
  )
}

function OTPCard({ email }: { email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [otp, setOtp] = useState("")

  async function verifyOtp() {
    const { data, error } = await auth.signIn.emailOtp({
      email,
      otp,
      fetchOptions: {
        onRequest: () => {
          setLoading(true)
        },
        onResponse: () => {
          setLoading(false)
        },
      },
    })

    if (data) {
      toast.success("Successfully logged in!")
      return router.replace("/dashboard")
    }

    if (error.code === "INVALID_OTP") toast.error("You entered an invalid OTP")
    else {
      toast.error("There was an unexpected error")
      console.error({ error })
    }
  }
  return (
    <form
      className="grid gap-4 items-center"
      onSubmit={async (e) => {
        e.preventDefault()
        await verifyOtp()
      }}
    >
      <p className="max-w-80 text-sm text-muted-foreground text-center">
        Check your <span className="text-foreground">{email}</span> inbox and spam to get the OTP.
      </p>
      <div className="grid gap-2">
        <Label htmlFor="email">OTP</Label>
        <InputOTP
          pushPasswordManagerStrategy="none"
          maxLength={6}
          value={otp}
          onChange={(v) => setOtp(v)}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-protonpass-ignore="true"
          type="text"
        >
          <InputOTPGroup>
            <InputOTPSlot className="bg-card" index={0} />
            <InputOTPSlot className="bg-card" index={1} />
            <InputOTPSlot className="bg-card" index={2} />
            <InputOTPSlot className="bg-card" index={3} />
            <InputOTPSlot className="bg-card" index={4} />
            <InputOTPSlot className="bg-card" index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button disabled={loading} className="self-stretch gap-2" onClick={verifyOtp}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify"}
      </Button>
    </form>
  )
}
