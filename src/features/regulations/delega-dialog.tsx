import { useServerFn } from "@tanstack/react-start"
import { useDeferredValue, useMemo, useState } from "react"

import {
  DateField,
  fieldControl,
  FormDialog,
  FormField,
  InlineAlert,
  RadioCard,
  RadioCardGroup,
  SelectField,
  Spinner,
} from "@/components/primitives"
import { SearchField } from "@/components/shell"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { todayInRome } from "./regulations-format"
import { failureMessage, useLoaded, useRefreshAfter } from "./regulations-hooks"
import { createDelega } from "./regulations-rectify.functions"
import type { DocumentInfo } from "./regulations.contract"
import { searchRegulationUsers } from "./regulations.functions"

const ALL = "__all__"

/**
 * The Segretario delegates rettifiche to any IdP account (Statuto, article "Direttivo", comma 9): optionally for one
 * document and until a date. The Segretario stays responsible; the backend emails the Direttivo.
 */
export function DelegaDialog({
  open,
  onOpenChange,
  documents,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: DocumentInfo[]
}) {
  const search = useServerFn(searchRegulationUsers)
  const create = useServerFn(createDelega)
  const refresh = useRefreshAfter()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const [userId, setUserId] = useState<string | null>(null)
  const [documentKey, setDocumentKey] = useState<string>(documents.length === 1 ? documents[0].key : ALL)
  const [expiresOn, setExpiresOn] = useState("")
  const [note, setNote] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const { data: users, failed } = useLoaded(
    useMemo(
      () => (open && deferredQuery.length >= 2 ? () => search({ data: { q: deferredQuery } }) : null),
      [open, deferredQuery, search]
    ),
    true
  )
  const expiryError =
    submitted && expiresOn !== "" && expiresOn < todayInRome() ? "Scegli una data da oggi in poi." : undefined

  async function submit() {
    setSubmitted(true)
    if (!userId) throw new Error("Scegli a chi delegare.")
    if (expiresOn !== "" && expiresOn < todayInRome()) return
    try {
      await create({
        data: {
          userId,
          documentKey: documentKey === ALL ? null : documentKey,
          // The end of the chosen day, in the browser's zone (Italy for the Segretario).
          expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : null,
          note: note.trim() || null,
        },
      })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile creare la delega."), { cause: caught })
    }
    await refresh("Delega creata. Il Direttivo riceve una email.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      locale="it"
      size="lg"
      title="Nuova delega di rettifica"
      description="La persona delegata potrà correggere errori di battitura e grammatica senza cambiare il significato del testo, ed emanare la rettifica. Resti responsabile tu; il Direttivo riceve una email."
      noun="la delega"
      dirty={userId !== null || note.trim() !== "" || expiresOn !== ""}
      submitLabel="Crea delega"
      canSubmit={userId !== null}
      submitOnEnter={false}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <SearchField
            label="Cerca un account"
            value={query}
            onChange={setQuery}
            placeholder="Nome o email (almeno 2 caratteri)…"
          />
          {failed ? (
            <InlineAlert>Non è stato possibile cercare gli account. Riprova.</InlineAlert>
          ) : deferredQuery.length < 2 ? (
            <p className="text-xs text-(--pn-fg-muted)">Qualsiasi account PoliNetwork, anche chi non è Socio.</p>
          ) : users === null ? (
            <div className="flex items-center gap-2 text-[13px] text-(--pn-fg-muted)">
              <Spinner /> Ricerca…
            </div>
          ) : users.length === 0 ? (
            <p className="text-[13px] text-(--pn-fg-muted)">Nessun account corrisponde.</p>
          ) : (
            <RadioCardGroup label="Delega a" hideLabel value={userId} onValueChange={setUserId}>
              {users.map((user) => (
                <RadioCard
                  key={user.id}
                  value={user.id}
                  label={user.name}
                  description={user.email ? <span className="font-mono">{user.email}</span> : undefined}
                />
              ))}
            </RadioCardGroup>
          )}
        </div>
        <div className="grid gap-5 shell:grid-cols-2">
          <FormField label="Documento" htmlFor="delega-document">
            <SelectField
              id="delega-document"
              value={documentKey}
              onChange={setDocumentKey}
              options={[
                { value: ALL, label: "Tutti i documenti" },
                ...documents.map((document) => ({ value: document.key, label: document.title })),
              ]}
            />
          </FormField>
          <FormField
            label="Scade il (facoltativo)"
            htmlFor="delega-expiry"
            hint="Senza data vale finché non la revochi."
            error={expiryError}
          >
            <DateField
              id="delega-expiry"
              value={expiresOn}
              onChange={setExpiresOn}
              invalid={expiryError !== undefined}
              futureYears={3}
              pastYears={0}
              placeholder="Nessuna scadenza"
            />
          </FormField>
        </div>
        <FormField label="Nota (facoltativa)" htmlFor="delega-note" counter={{ length: note.length, max: 500 }}>
          <Textarea
            id="delega-note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}
