import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NewGrant } from "./new-grant"

export default async function Loading() {
  return (
    <div className="container h-full">
      <div className="flex gap-4 justify-start items-center">
        <p>Telegram Grants</p>
        <NewGrant />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger className="w-30" value="all">
            All
          </TabsTrigger>
          <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Content />
        </TabsContent>
        <TabsContent value="ongoing">
          <Content />
        </TabsContent>
        <TabsContent value="scheduled">
          <Content />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Content() {
  return (
    <div className="flex flex-col w-full items-start justify-start py-4">
      <div className="grid gap-4 items-center grid-cols-5 w-full border-b py-2 font-bold">
        <p>Telegram ID</p>
        <p>Username</p>
        <p>Start Date</p>
        <p>End Date</p>
        <p>Interrupt</p>
      </div>
      {new Array(6).fill(0).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full my-2" />
      ))}
    </div>
  )
}
