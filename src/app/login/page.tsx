import { redirect } from "next/navigation"
import { getServerSession } from "@/server/auth"
import LoginForm from "./login-form"

export default async function Page() {
  const { data: session } = await getServerSession()
  if (session) return redirect("/dashboard")

  return (
    <main className="flex flex-1 items-center justify-center">
      <LoginForm />
    </main>
  )
}
