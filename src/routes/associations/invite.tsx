import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { z } from "zod"

import { AppMark } from "@/components/app-mark"
import { Button } from "@/components/ui/button"
import { statusLabel } from "@/features/association-portal/portal-ui"
import { getPortalInvitation, acceptPortalInvitation } from "@/features/association-portal/portal.functions"
import { getDashboardAccess, getSessionState } from "@/features/auth/auth.functions"
import { signInRedirect } from "@/lib/sign-in"

export const Route = createFileRoute("/associations/invite")({
  validateSearch: z.object({ token: z.string() }),
  beforeLoad: async ({ location }) => {
    if (!(await getSessionState()).signedIn) throw signInRedirect(location.href)
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const access = await getDashboardAccess()
    if (access.status === "unauthenticated") throw signInRedirect()
    return { invite: await getPortalInvitation({ data: deps }), account: access.user.email || access.user.name }
  },
  head: () => ({
    meta: [{ title: "Invito associazione — PoliNetwork" }, { name: "referrer", content: "no-referrer" }],
  }),
  component: Invitation,
})
function Invitation() {
  const { invite, account } = Route.useLoaderData()
  const { token } = Route.useSearch()
  const accept = useServerFn(acceptPortalInvitation)
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [acceptedId, setAcceptedId] = useState<string | null>(null)
  async function confirm() {
    setPending(true)
    setError("")
    let result: { id: string }
    try {
      result = await accept({ data: { token } })
    } catch (error) {
      console.error(error)
      setError(error instanceof Error ? error.message : "Impossibile accettare l’invito")
      setPending(false)
      return
    }
    setAcceptedId(result.id)
    // Replace the spent token before invalidating loaders. A navigation/reload error must never invite a second acceptance.
    try {
      await router.navigate({ to: "/dashboard/associations/$id", params: result, replace: true })
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      setError("Invito accettato. Apri la richiesta dal collegamento qui sotto.")
    }
  }
  return (
    <main className="min-h-dvh bg-background p-6">
      <AppMark />
      <section className="mx-auto mt-16 max-w-lg space-y-5 rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Rappresenta {invite.associationName}</h1>
        <p>
          Ruolo proposto: {statusLabel[invite.role]}. Accettando colleghi questa richiesta al tuo account personale.
          L’accesso sarà concesso solo dopo l’approvazione di PoliNetwork.
        </p>
        <p className="text-sm text-muted-foreground">
          Account: {account}. Scade il {new Date(invite.expiresAt).toLocaleDateString("it-IT")}.
        </p>
        {error && <p role="alert">{error}</p>}
        {acceptedId ? (
          <Link to="/dashboard/associations/$id" params={{ id: acceptedId }} className="underline">
            Apri la richiesta accettata
          </Link>
        ) : (
          <Button disabled={pending} onClick={() => void confirm()}>
            Accetta con questo account
          </Button>
        )}
        <Link to="/dashboard/associations" className="block text-sm underline">
          Vai alle tue associazioni
        </Link>
      </section>
    </main>
  )
}
