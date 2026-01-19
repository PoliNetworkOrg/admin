"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="grid gap-2">
      {!sent ? (
        <EmailCard
          email={email}
          onChange={(v) => setEmail(v)}
          onSend={() => setSent(true)}
        />
      ) : (
        <OTPCard email={email} />
      )}
    </div>
  );
}

function EmailCard({
  email,
  onChange,
  onSend,
}: {
  email: string;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    const { data, error } = await auth.emailOtp.sendVerificationOtp({
      type: "sign-in",
      email,
      fetchOptions: {
        onRequest: () => {
          setLoading(true);
        },
        onResponse: () => {
          setLoading(false);
        },
      },
    });

    if (data?.success) {
      onSend();
      toast.success("OTP sent via email!");
      return
    }

    toast.error("There was an unexpected error");
    console.error({ error });
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">Sign In</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Enter your email below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await sendOtp();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="mario.rossi@example.org"
              required
              onChange={(e) => {
                onChange(e.target.value);
              }}
              value={email}
            />
          </div>
          <Button disabled={loading} className="gap-2" onClick={sendOtp}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Sign-in with OTP"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function OTPCard({ email }: { email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");

  async function verifyOtp() {
    const { data, error } = await auth.signIn.emailOtp({
      email,
      otp,
      fetchOptions: {
        onRequest: () => {
          setLoading(true);
        },
        onResponse: () => {
          setLoading(false);
        },
      },
    });

    if (data) {
      toast.success("Successfully logged in!");
      return router.replace("/dashboard")
    }

    if (error.code === "INVALID_OTP") toast.error("You entered an invalid OTP");
    else {
      toast.error("There was an unexpected error")
      console.error({ error });
    }
  }
  return (
    <Card className="max-w-sm">
      <CardHeader className="items-center text-center">
        <CardTitle className="text-lg md:text-xl">Sign In</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Enter the OTP we sent to your email
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            await verifyOtp();
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
              data-1p-ignore data-lpignore="true" data-protonpass-ignore="true"
              type="text"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            disabled={loading}
            className="self-stretch gap-2"
            onClick={verifyOtp}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Verify"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
