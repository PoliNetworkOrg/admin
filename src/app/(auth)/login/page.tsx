import { redirect } from "next/navigation"
import { getServerSession } from "@/server/auth"
import LoginForm from "./login-form"
import { Card } from "@/components/ui/card"

export default async function Page() {
  const { data: session } = await getServerSession()
  if (session) return redirect("/dashboard")

  return (
    <main className="w-full flex flex-col flex-1 items-center justify-center max-w-3xl">
      <Card className="flex w-full bg-background flex-col items-center p-6">
        <h1 className="text-2xl font-bold mb-2 py-1">Login</h1>
        <p className="text-lg md:text-sm text-muted-foreground mb-6">Login with Email OTP or Passkey</p>
        <LoginForm />
      </Card>
    </main>
  )
}
