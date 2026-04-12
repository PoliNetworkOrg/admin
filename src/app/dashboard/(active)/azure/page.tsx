import { UsersRound } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import azureSvg from "@/assets/svg/azure.svg"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AssocIndex() {
  return (
    <div className="container py-8 px-2 flex flex-col gap-4">
      <h2 className="text-accent-foreground text-3xl font-bold flex gap-2 items-center">
        <Image alt="azure logo" src={azureSvg} className="size-7" />
        Azure
      </h2>
      <div className="gap-4 flex justify-start flex-wrap items-center">
        <Link href="/dashboard/azure/members">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <UsersRound size={20} />
                Members
              </CardTitle>
              <CardDescription>Manage all @polinetwork.org accounts</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
