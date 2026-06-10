import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Spinner } from "@/components/spinner"
import { getAzureMembers } from "@/server/actions/azure"
import { AssocTable } from "./table"

export default async function AssocMembers() {
  const members = await getAzureMembers()

  return (
    <div className="container p-8">
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <Suspense fallback={<Spinner />}>
          <AssocTable members={members} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
