import { redirect } from "next/navigation"
import { LoginButton } from "./login/login-button"
import { getServerSession } from "@/server/auth"
import { WhatIs } from "./login/what-is"
import { CanIAccess } from "./login/can-i-access"

export default async function IndexPage() {
  const session = await getServerSession()
  if (session.data?.user) redirect("/dashboard")

  return (
    <main className="text-accent container mx-auto flex grow flex-col items-center justify-start space-y-6 px-4 py-8">
      <LoginButton />
      <WhatIs />
      <CanIAccess />
    </main>
  )
}
