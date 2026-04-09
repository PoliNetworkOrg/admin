import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AssocIndex() {
  return (
    <div className="container p-8 gap-4 flex justify-start flex-wrap items-center">
      <Link href="/dashboard/assoc/members">
        <Card className="w-90 hover:bg-accent transition-colors">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage all @polinetwork.org accounts</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  )
}
