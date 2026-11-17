import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { UsersRound } from "lucide-react"
import { useState } from "react"
import type { z } from "zod"

import { EmptyState, FormDialog, SegmentedControl } from "@/components/primitives"
import { appToast, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"

import {
  cleanProfile,
  EMPTY_PROFILE,
  panelClass,
  parseForm,
  ProfileFields,
  ReasonDialog,
  statusLabel,
  TextField,
} from "./portal-ui"
import { createSchema, type dashboardSchema, type directorySchema } from "./portal.contract"
import { createPortalAssociation, changePortalAssociation } from "./portal.functions"

export function PortalIndex({
  portal,
  directory,
}: {
  portal: z.infer<typeof dashboardSchema>
  directory: z.infer<typeof directorySchema>
}) {
  const router = useRouter()
  const create = useServerFn(createPortalAssociation)
  const change = useServerFn(changePortalAssociation)
  const [view, setView] = useState<"registry" | "requests" | "directory">("registry")
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [explanation, setExplanation] = useState("")
  const [commandId, setCommandId] = useState(() => crypto.randomUUID())
  const [claim, setClaim] = useState<(typeof directory)[number] | null>(null)
  async function reload() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning("Salvato. Non è stato possibile aggiornare la pagina: ricaricala.")
    }
  }
  async function save(submit: boolean) {
    const data = parseForm(createSchema, { profile: cleanProfile(profile), explanation, submit, commandId })
    const result = await create({ data })
    // The command is spent: a further save would be a new one, never a replay of this idempotency key.
    setCommandId(crypto.randomUUID())
    await reload()
    setCreating(false)
    await router.navigate({ to: "/dashboard/associations/$id", params: { id: result.id } })
  }
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  return (
    <>
      <PageBar
        title={portal.operator ? "Registro associazioni" : "Le mie associazioni"}
        description={
          portal.operator
            ? "Registro, richieste di accesso e contenuti da approvare"
            : "Gestisci le tue associazioni o chiedi di rappresentarne una"
        }
        left={<Toolbar search={{ value: query, onChange: setQuery, placeholder: "Cerca associazione…" }} />}
        right={
          <Button
            onClick={() => {
              setProfile(EMPTY_PROFILE)
              setExplanation("")
              setCommandId(crypto.randomUUID())
              setCreating(true)
            }}
          >
            Registra un’associazione
          </Button>
        }
      />
      <PageContent width="wide">
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <SegmentedControl
              label="Viste associazioni"
              value={view}
              onValueChange={setView}
              items={[
                { value: "registry", label: portal.operator ? "Registro" : "Le mie associazioni" },
                {
                  value: "requests",
                  label: "Richieste",
                  count: portal.requests.filter((r) => r.status === "submitted").length,
                },
                { value: "directory", label: "Richiedi accesso" },
              ]}
            />
          </div>
          {view === "registry" &&
            (portal.associations.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {portal.associations
                  .filter((a) => matches(a.name))
                  .map((a) => (
                    <Link
                      key={a.id}
                      to="/dashboard/associations/$id"
                      params={{ id: a.id }}
                      className={`${panelClass} block hover:border-(--pn-accent)`}
                    >
                      <h2 className="font-semibold">{a.name}</h2>
                      <p className="text-sm text-(--pn-fg-muted)">
                        {statusLabel[a.status]} · {a.published ? "Pubblicata" : "Non pubblicata"}
                        {a.role ? ` · ${statusLabel[a.role]}` : ""}
                      </p>
                      {a.unrepresented && a.registered && portal.operator && (
                        <p className="text-sm">Nessun responsabile attivo</p>
                      )}
                      {!!a.pending && <p className="text-sm">{a.pending} richieste in revisione</p>}
                    </Link>
                  ))}
              </div>
            ) : (
              <EmptyState
                icon={UsersRound}
                title="Nessuna associazione collegata"
                text="Se l’associazione è già nel registro, richiedi accesso. Altrimenti invia una richiesta di registrazione."
                action={
                  <Button variant="outline" onClick={() => setView("directory")}>
                    Cerca nel registro
                  </Button>
                }
              />
            ))}
          {view === "requests" && (
            <div className="space-y-3">
              {portal.requests.length ? (
                portal.requests
                  .filter((r) => matches(r.associationName))
                  .map((r) => (
                    <Link
                      key={r.id}
                      to="/dashboard/associations/$id"
                      params={{ id: r.associationId }}
                      className={`${panelClass} block`}
                    >
                      <h2 className="font-medium">
                        {r.associationName} · {statusLabel[r.kind]}
                      </h2>
                      <p className="text-sm">
                        {statusLabel[r.status]} · {r.byName}
                      </p>
                      {r.response && <p className="text-sm text-(--pn-fg-muted)">{r.response}</p>}
                    </Link>
                  ))
              ) : (
                <p className="text-sm text-(--pn-fg-muted)">Non ci sono richieste.</p>
              )}
            </div>
          )}
          {view === "directory" && (
            <div className="space-y-3">
              <p className="text-sm text-(--pn-fg-muted)">
                Richiedi il collegamento al record esistente. PoliNetwork verificherà il tuo ruolo prima di concedere
                accesso.
              </p>
              {directory
                .filter((a) => matches(a.name))
                .map((a) => (
                  <div key={a.id} className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}>
                    <span className="font-medium">{a.name}</span>
                    <Button
                      variant="outline"
                      disabled={portal.associations.some((own) => own.id === a.id && own.role)}
                      onClick={() => setClaim(a)}
                    >
                      Richiedi accesso
                    </Button>
                  </div>
                ))}
              {!directory.length && <p>Il registro non contiene ancora associazioni attive.</p>}
            </div>
          )}
        </div>
        <FormDialog
          open={creating}
          onOpenChange={setCreating}
          title="Registra un’associazione"
          description="L’approvazione del registro e la pubblicazione sul sito sono due passaggi distinti."
          noun="associazione"
          locale="it"
          size="lg"
          dirty={profile.name !== "" || explanation !== ""}
          submitLabel="Invia richiesta"
          canSubmit={!!profile.name.trim() && !!explanation.trim()}
          onSubmit={() => save(true)}
          footerStart={
            <Button
              variant="ghost"
              disabled={!profile.name.trim() || !explanation.trim()}
              onClick={async () => {
                try {
                  await save(false)
                } catch (error) {
                  console.error(error)
                  appToast.error(error instanceof Error ? error.message : "Salvataggio non riuscito")
                }
              }}
            >
              Salva bozza
            </Button>
          }
        >
          <ProfileFields value={profile} onChange={setProfile} />
          <TextField
            label="Il tuo ruolo nell’associazione"
            value={explanation}
            onChange={setExplanation}
            multiline
            hint="Spiega perché puoi rappresentarla e indica riferimenti utili alla verifica. Non sarà pubblicato."
            maxLength={4000}
          />
        </FormDialog>
        {claim && (
          <ReasonDialog
            title={`Richiedi accesso a ${claim.name}`}
            description="Descrivi il tuo ruolo e come PoliNetwork può verificarlo."
            label="Invia richiesta"
            onClose={() => setClaim(null)}
            onSubmit={async (reason) => {
              const result = await change({
                data: {
                  id: claim.id,
                  revision: claim.revision,
                  commandId: crypto.randomUUID(),
                  action: "access",
                  explanation: reason,
                },
              })
              await reload()
              await router.navigate({ to: "/dashboard/associations/$id", params: { id: result.id } })
            }}
          />
        )}
      </PageContent>
    </>
  )
}
