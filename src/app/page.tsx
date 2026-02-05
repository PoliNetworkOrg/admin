import { redirect } from "next/navigation"
import { getServerSession } from "@/server/auth"
import { CanIAccess } from "./login/can-i-access"
import { WhatIs } from "./login/what-is"

export default async function IndexPage() {
  const session = await getServerSession()
  if (session.data?.user) redirect("/dashboard")

  return (
    <main className="text-accent container mx-auto flex grow flex-col items-center justify-start space-y-6 px-4 pb-8 pt-12">
      <WhatIs />
      <CanIAccess />
    </main>
  )
}
