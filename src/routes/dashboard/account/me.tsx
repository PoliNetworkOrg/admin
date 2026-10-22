import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { MyAreaPage } from "@/features/people/my-area-page"
import { getMyArea } from "@/features/people/people-self.functions"
import { inviteTokenSchema } from "@/features/people/people.contract"

export const Route = createFileRoute("/dashboard/account/me")({
  validateSearch: z.object({ peopleInvite: z.string().optional() }),
  loader: () => getMyArea(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <RecordSkeleton label="Loading your area…" />
      </PageContent>
    </>
  ),
  component: MyAreaRoute,
})

function MyAreaRoute() {
  // The invite link HR emails; a malformed token is ignored.
  const invite = inviteTokenSchema.safeParse(Route.useSearch().peopleInvite)
  return <MyAreaPage area={Route.useLoaderData()} invite={invite.success ? invite.data : null} />
}
