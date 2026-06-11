import { Skeleton } from "@/components/ui/skeleton"

export default async function Loading() {
  return (
    <div className="container">
      <div className="grid grid-cols-3 items-start gap-4 w-full">
        <Skeleton className="w-full h-44 rounded-xl" />
        <Skeleton className="w-full h-44 rounded-xl" />
      </div>

      <div className="w-full">
        <p>Admin in groups:</p>
        <div className="grid grid-cols-4 py-3 gap-4 w-full">
          <Skeleton className="w-full h-44 rounded-xl" />
          <Skeleton className="w-full h-44 rounded-xl" />
        </div>
      </div>

      <div className="w-full">
        <p>Last messages (max 12):</p>
        <div className="grid grid-cols-3 py-3 gap-4 w-full">
          <Skeleton className="w-full h-44 rounded-xl" />
          <Skeleton className="w-full h-44 rounded-xl" />
        </div>
      </div>

      <div className="w-full">
        <p>Audit log:</p>
        <div className="grid grid-cols-3 py-3 gap-4 w-full">
          {new Array(9).fill(0).map((_, i) => (
            <Skeleton key={i} className="w-full h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
