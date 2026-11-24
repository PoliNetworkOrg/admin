import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  checkboxControl,
  Chip,
  ConfirmDialog,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  RadioCard,
  RadioCardGroup,
  SelectField,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import {
  contactFunctionLabel,
  panelClass,
  parseForm,
  TextField,
  visibilityDescription,
  visibilityLabel,
} from "./portal-ui"
import { contactSchema, type Contact, type Detail } from "./portal.contract"

const functions: Contact["function"][] = ["presidency", "events", "collaborations", "communications", "other"]
const functionOptions = functions.map((value) => ({ value, label: contactFunctionLabel[value] }))
const visibilities: Contact["visibility"][] = ["public", "associations", "polinetwork"]

/** Shown whenever a name or a phone number is entered: both are personal data about a real person. */
export function PrivacyNotice() {
  return (
    <InlineAlert tone="info">
      Nome e telefono sono dati personali: inseriscili solo se la persona è d’accordo e tienili aggiornati. Collega il
      contatto al referente a cui si riferisce: se perde l’accesso, il contatto viene segnalato per l’aggiornamento.
      Informativa:{" "}
      <a href="https://polinetwork.org/privacy" target="_blank" rel="noreferrer" className="underline">
        polinetwork.org/privacy
      </a>
      .
    </InlineAlert>
  )
}

/**
 * Contacts by function. Non-public ones are saved at once; public ones become part of the profile proposal, which the
 * responsible submits to PoliNetwork like any other change to the public profile.
 */
export function ContactsPanel({
  association: a,
  onSave,
  onCollaboration,
}: {
  association: Detail
  onSave: (contacts: Contact[]) => Promise<void>
  onCollaboration: (open: boolean, contactId: string | null) => Promise<void>
}) {
  const working = a.requests.find((q) => q.kind === "content" && ["draft", "changes", "submitted"].includes(q.status))
  const shown = (working?.profile ?? a.profile).contacts
  const all: Contact[] = [...shown, ...a.contacts]
  const publishedIds = new Set((a.publishedProfile?.contacts ?? []).map((c) => JSON.stringify(c)))
  const unpublished = shown.filter((c) => !publishedIds.has(JSON.stringify(c)))
  const removedFromSite = (a.publishedProfile?.contacts ?? []).some((c) => !shown.some((s) => s.id === c.id))
  const stale = all.filter((c) => a.staleContacts.includes(c.id))
  const [editing, setEditing] = useState<Contact | null>(null)
  const [removing, setRemoving] = useState<Contact | null>(null)
  const memberName = (sub: string | null) => a.members.find((m) => m.sub === sub)?.name
  const blocked = working?.status === "submitted"
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Contatti</h2>
        {a.canEdit && a.registered && (
          <Button
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                function: "presidency",
                label: "",
                email: "",
                name: "",
                phone: "",
                visibility: "associations",
                holderSub: null,
              })
            }
          >
            Aggiungi contatto
          </Button>
        )}
      </div>
      <p className="text-sm text-(--pn-fg-muted)">
        I contatti pubblici passano dalla revisione di PoliNetwork; gli altri si salvano subito e restano nello storico.
      </p>
      {stale.length > 0 && (
        <InlineAlert tone="warning">
          Da aggiornare: {stale.map((c) => c.label).join(", ")}. Il referente collegato non ha più accesso
          all’associazione.
        </InlineAlert>
      )}
      {(unpublished.length > 0 || removedFromSite) && (
        <InlineAlert tone="info">
          {working?.status === "submitted"
            ? "I contatti pubblici modificati sono nella proposta in revisione da PoliNetwork."
            : a.canSubmit
              ? "I contatti pubblici modificati sono nella proposta di scheda: inviala a PoliNetwork dalla sezione Richieste."
              : "I contatti pubblici modificati sono nella proposta di scheda: un responsabile deve inviarla a PoliNetwork."}
        </InlineAlert>
      )}
      {blocked && a.canEdit && (
        <p className="text-sm text-(--pn-fg-muted)">
          Mentre la proposta di scheda è in revisione puoi modificare solo i contatti non pubblici.
        </p>
      )}
      {all.length === 0 && <p className="text-sm text-(--pn-fg-muted)">Non ci sono contatti.</p>}
      <ul className="divide-y divide-(--pn-line)">
        {all.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{c.label}</p>
              <p className="flex flex-wrap gap-1.5">
                <Chip>{contactFunctionLabel[c.function]}</Chip>
                <Chip>{visibilityLabel[c.visibility]}</Chip>
              </p>
              <p className="text-sm break-all">{c.email}</p>
              {(c.name || c.phone) && (
                <p className="text-sm text-(--pn-fg-muted)">{[c.name, c.phone].filter(Boolean).join(" · ")}</p>
              )}
              {c.holderSub && (
                <p className="text-[13px] text-(--pn-fg-muted)">
                  Riferito a {memberName(c.holderSub) ?? "un ex referente"}
                </p>
              )}
            </div>
            {a.canEdit && !(blocked && c.visibility === "public") && (
              <div className="flex gap-0.5">
                <IconButton
                  icon={Pencil}
                  label="Modifica contatto"
                  ariaLabel={`Modifica ${c.label}`}
                  onClick={() => setEditing(c)}
                />
                <IconButton
                  icon={Trash2}
                  tone="danger"
                  label="Rimuovi contatto"
                  ariaLabel={`Rimuovi ${c.label}`}
                  onClick={() => setRemoving(c)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <CollaborationCard association={a} contacts={all} onSave={onCollaboration} />
      {editing && (
        <ContactDialog
          key={editing.id}
          contact={editing}
          isNew={!all.some((c) => c.id === editing.id)}
          association={a}
          publicLocked={blocked}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            const exists = all.some((c) => c.id === next.id)
            await onSave(exists ? all.map((c) => (c.id === next.id ? next : c)) : [...all, next])
            setEditing(null)
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Rimuovere il contatto?"
        description={
          removing?.visibility === "public"
            ? "Il contatto resta sul sito finché PoliNetwork non approva la nuova scheda."
            : "Il contatto non sarà più visibile. La rimozione resta nello storico."
        }
        confirmLabel="Rimuovi contatto"
        cancelLabel="Annulla"
        onConfirm={async () => {
          if (!removing) return
          await onSave(all.filter((c) => c.id !== removing.id))
          setRemoving(null)
        }}
      />
    </section>
  )
}

function ContactDialog({
  contact,
  isNew,
  association: a,
  publicLocked,
  onClose,
  onSave,
}: {
  contact: Contact
  isNew: boolean
  association: Detail
  publicLocked: boolean
  onClose: () => void
  onSave: (contact: Contact) => Promise<void>
}) {
  const [value, setValue] = useState(contact)
  const set = <K extends keyof Contact>(key: K, next: Contact[K]) => setValue({ ...value, [key]: next })
  const holders = [
    { value: "", label: "Nessuno" },
    ...a.members.filter((m) => m.active).map((m) => ({ value: m.sub, label: m.name })),
  ]
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={isNew ? "Aggiungi contatto" : "Modifica contatto"}
      description="Indica a chi scrivere per ciascuna funzione dell’associazione."
      noun="contatto"
      locale="it"
      dirty={JSON.stringify(value) !== JSON.stringify(contact)}
      submitLabel={value.visibility === "public" ? "Aggiungi alla proposta" : "Salva contatto"}
      canSubmit={!!value.label.trim() && !!value.email.trim()}
      onSubmit={() => onSave(parseForm(contactSchema, value))}
    >
      <FormField htmlFor="contact-function" label="Funzione">
        <SelectField
          id="contact-function"
          value={value.function}
          options={functionOptions}
          onChange={(fn) => set("function", fn)}
        />
      </FormField>
      <TextField
        label="Etichetta"
        value={value.label}
        onChange={(label) => set("label", label)}
        maxLength={100}
        hint="Ad esempio “Ufficio eventi” o “Presidenza”."
      />
      <TextField
        label="Email"
        type="email"
        value={value.email}
        onChange={(email) => set("email", email)}
        maxLength={320}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nome (facoltativo)"
          value={value.name}
          onChange={(name) => set("name", name)}
          maxLength={120}
        />
        <TextField
          label="Telefono (facoltativo)"
          type="tel"
          value={value.phone}
          onChange={(phone) => set("phone", phone)}
          maxLength={40}
        />
      </div>
      {(value.name.trim() || value.phone.trim()) && <PrivacyNotice />}
      <FormField htmlFor="contact-holder" label="Referente a cui si riferisce (facoltativo)">
        <SelectField
          id="contact-holder"
          value={value.holderSub ?? ""}
          options={holders}
          onChange={(sub) => set("holderSub", sub || null)}
        />
      </FormField>
      <RadioCardGroup label="Visibilità" value={value.visibility} onValueChange={(v) => set("visibility", v)}>
        {visibilities
          .filter((v) => !(publicLocked && v === "public" && contact.visibility !== "public"))
          .map((v) => (
            <RadioCard key={v} value={v} label={visibilityLabel[v]} description={visibilityDescription[v]} />
          ))}
      </RadioCardGroup>
    </FormDialog>
  )
}

/** Open to collaborations, and which contact other associations should write to. Shown in the portal directory only. */
function CollaborationCard({
  association: a,
  contacts,
  onSave,
}: {
  association: Detail
  contacts: Contact[]
  onSave: (open: boolean, contactId: string | null) => Promise<void>
}) {
  const [open, setOpen] = useState(a.collaboration.open)
  const [contactId, setContactId] = useState(a.collaboration.contactId ?? "")
  const [saving, setSaving] = useState(false)
  const dirty = open !== a.collaboration.open || (contactId || null) !== a.collaboration.contactId
  return (
    <div className="space-y-3 border-t border-(--pn-line) pt-4">
      <h3 className="text-sm font-medium">Collaborazioni</h3>
      <label className="flex items-start gap-2.5 text-[14px]">
        <Checkbox
          checked={open}
          disabled={!a.canEdit}
          onCheckedChange={(checked) => setOpen(checked === true)}
          className={checkboxControl}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Aperta a collaborazioni con altre associazioni</span>
          <span className="text-[13px] text-(--pn-fg-muted)">
            Compare nell’elenco delle associazioni del portale, non sul sito.
          </span>
        </span>
      </label>
      {open && a.canEdit && (
        <FormField
          htmlFor="collaboration-contact"
          label="Contatto dedicato (facoltativo)"
          hint="Le altre associazioni lo vedono solo se la sua visibilità lo permette."
        >
          <SelectField
            id="collaboration-contact"
            value={contactId}
            options={[
              { value: "", label: "Nessuno" },
              ...contacts.map((c) => ({ value: c.id, label: `${c.label} · ${c.email}` })),
            ]}
            onChange={setContactId}
          />
        </FormField>
      )}
      {a.canEdit && (
        <Button
          variant="outline"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave(open, open ? contactId || null : null)
            } catch (error) {
              console.error(error)
              appToast.error(error instanceof Error ? error.message : "Non è stato possibile salvare.")
            } finally {
              setSaving(false)
            }
          }}
        >
          Salva collaborazioni
        </Button>
      )}
    </div>
  )
}
