import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Spinner } from "@/components/spinner"
import { getQueryClient, trpc } from "@/lib/trpc/server"
import { AssocTable } from "./table"

export default async function AssocIndex() {
  const qc = getQueryClient()
  void qc.prefetchQuery(trpc.azure.members.getAll.queryOptions())
  return (
    <div className="container p-8">
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<Spinner />}>
          <AssocTable />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
