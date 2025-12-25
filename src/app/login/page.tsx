import { redirect } from "next/navigation"
import { getBaseUrl } from "@/lib/utils"
import { getServerSession } from "@/server/auth"
import { CanIAccess } from "./can-i-access"
import { Github } from "./github"
import { WhatIs } from "./what-is"

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams
  const callbackURL = `${getBaseUrl()}${callbackUrl ?? "/login/success"}`

  const session = await getServerSession()
  if (session.data?.user) redirect("/login/success")

  return (
    <main className="text-accent container mx-auto flex grow flex-col items-center justify-start space-y-6 px-4 py-8">
      <Github callbackURL={callbackURL} />
      <WhatIs />
      <CanIAccess />
    </main>
  )
}
