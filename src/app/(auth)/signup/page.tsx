"use client"
import { ArrowLeft, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthCard, MaxStage } from "../auth-card"

export default function Signup() {
  const [stage, setStage] = useState<number>(2)
  return (
    <>
      <Link href={"/"} className="flex gap-1 items-center">
        <ArrowLeft /> Back to home
      </Link>
      <AuthCard type="signup" stage={stage}>
        <div className="w-full flex flex-col gap-6 p-6">
          {stage === 1 && (
            <div className="grid gap-4">
              <h3 className="text-2xl font-semibold">Profile Setup</h3>
              <p className="text-sm text-muted-foreground">Fake inputs for demo purposes.</p>
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" placeholder="Mario" className="bg-background" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" placeholder="Rossi" className="bg-background" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" placeholder="mariorossi" className="bg-background" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="headline">Headline</Label>
                <Input id="headline" placeholder="Student and Open Source enthusiast" className="bg-background" />
              </div>
            </div>
          )}
          <div className="w-full flex justify-center items-center gap-4">
            <Button size="icon" onClick={() => setStage((v) => Math.max(0, v - 1))}>
              <ArrowLeft />
            </Button>
            <Button size="icon" onClick={() => setStage((v) => Math.min(MaxStage.signup, v + 1))}>
              <ArrowRight />
            </Button>
          </div>
        </div>
      </AuthCard>
    </>
  )
}
