import { getServerSession } from "@/server/auth"

export default async function AdminHome() {
  const session = await getServerSession()
  return (
    session && (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Home</h2>
      </div>
    )
  )
}
