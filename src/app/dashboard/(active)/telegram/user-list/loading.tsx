import { Skeleton } from "@/components/ui/skeleton"

export default async function Loading() {
  return (
    <div className="container p-8">
      <div className="flex items-center pt-4 gap-1">
        <p className="text-sm text-muted-foreground">Count: </p>
        <Skeleton className="w-10 h-5" />
      </div>
      <div className="flex flex-col w-full items-start justify-start py-4">
        <div className="grid gap-4 items-center grid-cols-3 w-full border-b py-2 font-bold">
          <p>Telegram ID</p>
          <p>Username</p>
          <p>Name</p>
        </div>
        {new Array(12).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full my-2" />
        ))}
      </div>
    </div>
  )
}
