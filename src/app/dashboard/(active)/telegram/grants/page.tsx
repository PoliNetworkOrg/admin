import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { trpc } from "@/server/trpc"
import { GrantList } from "./grant-list"
import { NewGrant } from "./new-grant"

export default async function GrantsPage() {
  const { grants: ongoing } = await trpc.tg.grants.getOngoing.query()
  const { grants: scheduled } = await trpc.tg.grants.getScheduled.query()

  return (
    <div className="container">
      <div className="flex gap-4 justify-start items-center">
        <p>Telegram Grants</p>
        <NewGrant />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger className="w-30" value="all">
            All
          </TabsTrigger>
          <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <GrantList grants={[...ongoing, ...scheduled]} />
        </TabsContent>
        <TabsContent value="ongoing">
          <GrantList grants={ongoing} />
        </TabsContent>
        <TabsContent value="scheduled">
          <GrantList grants={scheduled} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
