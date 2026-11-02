import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { getSessionState } from "@/features/auth/auth.functions"
import { InviteLandingPage } from "@/features/people/invite-landing-page"
import { checkPeopleInvite, getPeopleInviteOutcome } from "@/features/people/people-invite-landing.functions"
import { inviteTokenSchema } from "@/features/people/people.contract"
import { signInRedirect } from "@/lib/sign-in"

/**
 * The link in a People invite email. Outside the dashboard shell and its gate: any signed-in account may open it,
 * including one with no permissions yet. `linked` replaces the single-use token once it has been accepted, so a
 * reload shows the outcome instead of a spent link.
 */
export const Route = createFileRoute("/people/invite")({
  validateSearch: z.object({ token: z.string().optional(), linked: z.boolean().optional() }),
  beforeLoad: async ({ location }) => {
    const { signedIn } = await getSessionState()
    if (!signedIn) throw signInRedirect(location.href)
  },
  loaderDeps: ({ search }) => ({ token: search.token, linked: search.linked ?? false }),
  loader: async ({ deps }) => {
    if (deps.linked) return { step: "linked", outcome: await getPeopleInviteOutcome() } as const
    const token = inviteTokenSchema.safeParse(deps.token)
    if (!token.success) return { step: "malformed" } as const
    return {
      step: "check",
      token: token.data,
      check: await checkPeopleInvite({ data: { token: token.data } }),
    } as const
  },
  head: () => ({ meta: [{ title: "Link your account - PoliNetwork Admin" }] }),
  component: InviteRoute,
})

function InviteRoute() {
  return <InviteLandingPage state={Route.useLoaderData()} />
}
