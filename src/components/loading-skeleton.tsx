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
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex flex-col gap-2 border-b border-border pb-6">
        <Skeleton className="h-2.5 w-20 rounded-none" />
        <Skeleton className="h-4 w-44 rounded-none" />
        <Skeleton className="h-3 w-80 max-w-full rounded-none" />
      </div>
      <div className="flex flex-wrap items-center gap-3 py-1">
        <Skeleton className="h-9 w-full max-w-xs rounded-none" />
        <Skeleton className="ml-auto h-3 w-16 rounded-none max-sm:ml-0" />
      </div>
      <div className="flex flex-col gap-3">
        {withTabs && (
          <div className="flex gap-1">
            <Skeleton className="h-8 w-16 rounded-none" />
            <Skeleton className="h-8 w-20 rounded-none" />
            <Skeleton className="h-8 w-24 rounded-none" />
          </div>
        )}
        <div className="overflow-hidden border border-border bg-card">
          <div
            className="grid gap-4 border-b border-border bg-muted px-[15px] py-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }, (_, index) => (
              <Skeleton key={`heading-${index}`} className="h-2.5 w-16 rounded-none" />
            ))}
          </div>
          {Array.from({ length: rows }, (_, row) => (
            <div
              key={`row-${row}`}
              className="grid gap-4 border-b border-border px-[15px] py-3 last:border-0"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }, (_, column) => (
                <Skeleton
                  key={`cell-${row}-${column}`}
                  className={`h-3 rounded-none ${column === 0 ? "w-24" : "w-32 max-w-full"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]" aria-busy="true">
      <Skeleton className="h-3 w-24 rounded-none" />
      <div className="flex items-center gap-[18px] bg-sidebar px-[35px] py-[35px] max-[600px]:px-6 max-[600px]:py-6">
        <Skeleton className="size-14 shrink-0 rounded-full bg-sidebar-accent" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-2.5 w-36 rounded-none bg-sidebar-accent" />
          <Skeleton className="h-6 w-52 max-w-full rounded-none bg-sidebar-accent" />
          <Skeleton className="h-2.5 w-28 rounded-none bg-sidebar-accent" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col gap-4 border border-border bg-card p-5">
            <Skeleton className="size-5 rounded-none" />
            <Skeleton className="h-2.5 w-20 rounded-none" />
            <Skeleton className="h-3 w-36 max-w-full rounded-none" />
            <Skeleton className="h-3 w-28 max-w-full rounded-none" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }, (_, section) => (
        <section key={section} className="mt-4">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <Skeleton className="h-5 w-40 rounded-none" />
            <Skeleton className="h-2.5 w-5 rounded-none" />
          </div>
          <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
            <Skeleton className="h-24 rounded-none" />
            <Skeleton className="h-24 rounded-none" />
          </div>
        </section>
      ))}
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-2.5 w-28 rounded-none" />
        <Skeleton className="h-11 w-80 max-w-full rounded-none" />
        <Skeleton className="h-3 w-full max-w-md rounded-none" />
      </div>
      <div className="grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-none" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-none" />
    </div>
  )
}
