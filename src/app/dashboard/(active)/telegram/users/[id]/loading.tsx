import { Skeleton } from "@/components/ui/skeleton"

export default async function Loading() {
  return (
    <div className="container">
      <div className="grid grid-cols-3 items-start gap-4">
        <Skeleton className="w-full h-44 rounded-xl" />
        <Skeleton className="w-full h-44 rounded-xl" />
      </div>
      <p className="pt-6">Admin in groups:</p>
      <div className="grid grid-cols-3 items-start gap-4">
        <Skeleton className="w-full h-44 rounded-xl" />
        <Skeleton className="w-full h-44 rounded-xl" />
      </div>
      <p className="pt-6">Last messages (max 12):</p>
      <div className="grid grid-cols-3 items-start gap-4">
        <Skeleton className="w-full h-44 rounded-xl" />
        <Skeleton className="w-full h-44 rounded-xl" />
      </div>
      <p className="pt-6">Audit log:</p>
      <div className="grid grid-cols-3 items-start gap-4">
        {new Array(9).fill(0).map((_, i) => (
          <Skeleton key={i} className="w-full h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
