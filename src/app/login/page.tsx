import { redirect } from "next/navigation"
import { getServerSession } from "@/server/auth"
import LoginForm from "./login-form"

export default async function Page() {
  const { data: session } = await getServerSession()
  if (session) return redirect("/dashboard")

  return (
    <main className="w-full flex flex-col flex-1 items-start justify-start max-w-4xl pt-12">
      <h1 className="text-4xl font-black mb-2">Login</h1>
      <p className="text-lg md:text-sm mb-4">
        Enter your email below to recieve an OTP to login or use a registered passkey.
      </p>
      <LoginForm />
    </main>
  )
}
