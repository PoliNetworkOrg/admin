"use client"

import { ArrowRight, Key, Loader2, Mail } from "lucide-react"
import { redirect, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { auth } from "@/lib/auth"
import { checkEmail } from "@/server/actions/auth"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { FieldSeparator } from "@/components/ui/field"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const _router = useRouter()

  // useEffect(() => {
  //   if (!PublicKeyCredential.isConditionalMediationAvailable ||
  //     !PublicKeyCredential.isConditionalMediationAvailable()) {
  //     return;
  //   }
  //
  //   void auth.signIn.passkey({ autoFill: true }).then(({ data, error }) => {
  //     if (error) {
  //       if ("code" in error && error.code === "AUTH_CANCELLED") return
  //       console.error("ERROR PASSKEY LOGIN", error)
  //       toast.error("Error passkey")
  //       return
  //     }
  //
  //     console.log({ data })
  //     toast.success("Logged in with passkey!")
  //     router.refresh()
  //   })
  // }, [])

  return (
    <div className="flex flex-col gap-6 py-2 px-2">
      <EmailCard email={email} onChange={(v) => setEmail(v)} onSend={() => setSent(true)} />
      {sent && <OTPCard email={email} />}
      <p className="text-muted-foreground text-center text-sm">
        Don&apos;t have an account?
        <Link className="underline ml-1" href="/auth/signup">
          Sign up
        </Link>
      </p>
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

  async function sendOtp() {
    console.log("Called sendOtp")
    const checkEmailRes = await checkEmail(email)

    if (checkEmailRes.error) {
      toast.error(checkEmailRes.error)
      return
    }

    if (!checkEmailRes.exists) {
      toast.warning("No user with this email found, redirecting to signup.")
      // redirect("/signup")
      return
    }

    // const { data: passkeyData, error: passkeyError } = await auth.signIn.passkey({
    //   autoFill: true,
    //   fetchOptions: {
    //     onRequest: () => {
    //       setLoading(true)
    //       console.log("call to signIn.passkey REQUEST")
    //     },
    //     onResponse: () => {
    //       console.log("call to signIn.passkey RESPONSE")
    //       setLoading(false)
    //     },
    //   },
    // })
    //
    // console.log("signIn.passkey RESULT", { passkeyData, passkeyError })
    //
    // if (passkeyData && !passkeyError) {
    //   toast.success("Logged in with passkey!")
    //   router.push("/dashboard")
    //   return
    // }

    console.log("Call to emailOtp.sendVerificationOtp")
    const { data, error } = await auth.emailOtp.sendVerificationOtp({
      type: "sign-in",
      email,
      fetchOptions: {
        onRequest: () => {
          setLoading(true)
          console.log("call to emailTop.sendVerificationOtp REQUEST")
        },
        onResponse: () => {
          console.log("call to emailTop.sendVerificationOtp RESPONSE")
          setLoading(false)
        },
      },
    })

    if (data?.success) {
      onSend()
      console.log("call to emailTop.sendVerificationOtp SUCCESS", { data, error })
      toast.success("OTP sent via email!")
      return
    }

    console.log("call to emailTop.sendVerificationOtp ERROR", { data, error })

    if (error?.code === "INVALID_EMAIL") {
      toast.error("Invalid email")
      return
    }

    toast.error("There was an unexpected error")
    console.error({ error })
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
      <Button type="submit" disabled={loading} className="basis-9 group" variant="secondary">
        {loading ? (
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
