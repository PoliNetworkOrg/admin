import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerSession } from "@/server/auth"
import LoginForm from "./login-form"

export default async function Page() {
  const { data: session } = await getServerSession()
  if (session) return redirect("/dashboard")

  return (
    <main className="w-full flex flex-col flex-1 items-center justify-center max-w-3xl">
      <Card className="flex w-full bg-background flex-col items-center p-6">
        <CardHeader className="w-full">
          <CardTitle className="text-2xl font-bold py-1">Login</CardTitle>
          <CardDescription className="text-lg md:text-sm text-muted-foreground">
            Login with Email OTP or Passkey
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
