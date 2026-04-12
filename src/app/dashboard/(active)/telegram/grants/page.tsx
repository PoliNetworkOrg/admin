import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { GrantList } from "./grant-list"
import { NewGrant } from "./new-grant"

export default function GrantsPage() {
  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="py-4 flex  gap-4 justify-start items-center">
        <p>Telegram Grants</p>
        <NewGrant />
      </div>
      <GrantList />
    </div>
  )
}
