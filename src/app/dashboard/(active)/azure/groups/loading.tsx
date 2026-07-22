import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="container w-full max-w-6xl">
      <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-112 max-w-full" />
        </div>

        <Card className="w-full gap-0 py-0">
          <CardHeader className="border-b py-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="px-0">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                {index > 0 && <Separator />}
                <div className="grid gap-5 px-4 py-5 lg:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.25fr)] lg:items-center">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-48 max-w-full" />
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="flex items-center gap-2 lg:justify-end">
                    {Array.from({ length: 5 }, (_, avatarIndex) => (
                      <Skeleton key={avatarIndex} className="size-9 rounded-full" />
                    ))}
                    <Skeleton className="h-8 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
