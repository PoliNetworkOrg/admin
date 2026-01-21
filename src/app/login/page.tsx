import { getServerSession } from "@/server/auth"
import LoginForm from "./login-form"
import { redirect } from "next/navigation"

export default async function Page() {
  const { data: session } = await getServerSession()
  if (session) return redirect("/dashboard")

  return (
    <main className="flex flex-1 items-center justify-center">
      <LoginForm />
    </main>
  )
}
