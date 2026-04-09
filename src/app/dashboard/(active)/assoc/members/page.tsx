import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Spinner } from "@/components/spinner"
import { getQueryClient, trpc } from "@/lib/trpc/server"
import { AssocTable } from "./table"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function AssocMembers() {
  const qc = getQueryClient()
  void qc.prefetchQuery(trpc.azure.members.getAll.queryOptions())
  return (
    <div className="container p-8">
      <Link href="/dashboard/assoc" className="flex gap-1 items-center text-muted-foreground mb-2 hover:underline">
        <ArrowLeft size={16} /> Back
      </Link>
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<Spinner />}>
          <AssocTable />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
