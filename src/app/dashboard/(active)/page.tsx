import { getServerSession } from "@/server/auth"
import { CompleteProfile } from "./complete-profile"

export default async function AdminHome() {
  const { data: session } = await getServerSession()
  return (
    session && (
      <div className="container mx-auto px-4 py-8">
        <CompleteProfile user={session.user} />
        <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Home</h2>
      </div>
    )
  )
}
