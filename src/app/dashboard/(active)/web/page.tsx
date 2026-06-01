import { CircleQuestionMark, Globe } from "lucide-react"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function WebIndex() {
  return (
    <div className="container py-8 px-2 flex flex-col gap-4">
      <h2 className="text-accent-foreground text-3xl font-bold flex gap-2 items-center">
        <Globe className="size-7" />
        Web
      </h2>
      <div className="gap-4 flex justify-start flex-wrap items-center">
        <Link href="/dashboard/web/faqs">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <CircleQuestionMark size={20} />
                FAQs
              </CardTitle>
              <CardDescription>Manage FAQs</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
