import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { getServerSession } from "@/server/auth"
import { CanIAccess } from "./(auth)/login/can-i-access"
import { WhatIs } from "./(auth)/login/what-is"

export default async function IndexPage() {
  const session = await getServerSession()
  if (session.data?.user) redirect("/dashboard")

  return (
    <>
      <Header />
      <main className="text-accent container mx-auto flex grow flex-col items-center justify-start space-y-6 px-4 pb-8 pt-12">
        <WhatIs />
        <CanIAccess />
      </main>
    </>
  )
}
