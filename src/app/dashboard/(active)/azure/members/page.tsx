import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Spinner } from "@/components/spinner"
import { getAzureMembers } from "@/server/actions/azure"
import { AssocTable } from "./table"

export default async function AssocMembers() {
  const members = await getAzureMembers()

  return (
    <div className="container p-8">
      <Link href="/dashboard/azure" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<Spinner />}>
          <AssocTable members={members} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
