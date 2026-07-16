import { Skeleton } from "@/components/ui/skeleton"

export function DataPageSkeleton({
  columns = 4,
  rows = 7,
  withTabs = false,
}: {
  columns?: number
  rows?: number
  withTabs?: boolean
}) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-52 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex min-h-16 flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="ml-auto h-4 w-20 max-sm:ml-0" />
      </div>
      {withTabs && (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          className="grid gap-4 border-b border-border bg-muted/75 px-4 py-3.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={`heading-${index}`} className="h-2.5 w-16" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={`row-${row}`}
            className="grid gap-4 border-b border-border px-4 py-4 last:border-0"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={`cell-${row}-${column}`} className={`h-3 ${column === 0 ? "w-24" : "w-32 max-w-full"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-52 max-w-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <Skeleton className="size-5" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-36 max-w-full" />
            <Skeleton className="h-3 w-28 max-w-full" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }, (_, section) => (
        <section key={section} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </section>
      ))}
    </div>
  )
}
