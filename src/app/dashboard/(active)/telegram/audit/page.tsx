import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function TgAudit() {
  return (
    <div className="container p-8">
      <Link href="/dashboard/telegram" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <p>To Implement</p>
    </div>
  )
}
