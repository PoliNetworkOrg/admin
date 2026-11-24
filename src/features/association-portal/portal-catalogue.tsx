import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Archive, ArchiveRestore, GraduationCap, Pencil } from "lucide-react"
import { useState } from "react"

import {
  DataTable,
  EmptyState,
  FormDialog,
  IconButton,
  RadioCard,
  RadioCardGroup,
  RowActions,
  SegmentedControl,
  StatusBadge,
  type DataTableColumn,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, Toolbar } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { savePortalCatalogue } from "./portal-review.functions"
import { parseForm, TextField } from "./portal-ui"
import { catalogueEntrySchema, type CatalogueEntry } from "./portal.contract"

const kindLabel = { programme: "Corso di studio", campus: "Sede" } satisfies Record<CatalogueEntry["kind"], string>

/**
 * Operators' catalogue of degree programmes and campuses that associations can list. Programme keys follow the group
 * labels (`didattica.<scuola>.<livello>.<corso>`); entries are retired, never deleted, so profiles keep their meaning.
 */
export function PortalCatalogue({ catalogue }: { catalogue: CatalogueEntry[] }) {
  const router = useRouter()
  const save = useServerFn(savePortalCatalogue)
  const [kind, setKind] = useState<CatalogueEntry["kind"]>("programme")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<{ entry: CatalogueEntry; isNew: boolean } | null>(null)
  const ofKind = catalogue.filter((e) => e.kind === kind)
  const rows = ofKind.filter((e) =>
    `${e.nameIt} ${e.nameEn} ${e.slug}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  )
  async function store(entry: CatalogueEntry, message: string) {
    await save({ data: parseForm(catalogueEntrySchema, entry) })
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning("Salvato, ma la pagina non si è aggiornata. Ricaricala senza ripetere l’operazione.")
      return
    }
    appToast.success(message)
  }
  const columns: DataTableColumn<CatalogueEntry>[] = [
    {
      id: "name",
      label: "Nome",
      fill: true,
      mobile: "main",
      cell: (e) => (
        <span className="flex flex-col">
          <span className="font-medium">{e.nameIt}</span>
          <span className="text-xs text-(--pn-fg-muted)" lang="en">
            {e.nameEn}
          </span>
        </span>
      ),
    },
    {
      id: "slug",
      label: "Chiave",
      mono: true,
      priority: 2,
      width: 380,
      cell: (e) => <span className="block truncate">{e.slug}</span>,
    },
    {
      id: "status",
      label: "Stato",
      priority: 1,
      width: 120,
      mobile: "end",
      cell: (e) => (e.active ? null : <StatusBadge tone="neutral">Ritirato</StatusBadge>),
    },
  ]
  return (
    <>
      <PageBar
        title="Corsi e sedi"
        description={`${catalogue.filter((e) => e.kind === "programme").length} corsi e ${catalogue.filter((e) => e.kind === "campus").length} sedi tra cui le associazioni possono scegliere`}
        left={
          <Toolbar
            lead={
              <SegmentedControl
                label="Tipo"
                value={kind}
                onValueChange={setKind}
                items={[
                  { value: "programme", label: "Corsi" },
                  { value: "campus", label: "Sedi" },
                ]}
              />
            }
            search={{
              value: query,
              onChange: setQuery,
              placeholder: kind === "programme" ? "Cerca un corso…" : "Cerca una sede…",
            }}
          />
        }
        right={
          <Button
            onClick={() => setEditing({ isNew: true, entry: { kind, slug: "", nameIt: "", nameEn: "", active: true } })}
          >
            {kind === "programme" ? "Aggiungi corso" : "Aggiungi sede"}
          </Button>
        }
      />
      <PageContent width="wide">
        <DataTable
          label={kind === "programme" ? "Corsi di studio" : "Sedi"}
          columns={columns}
          rows={rows}
          getRowId={(e) => `${e.kind}:${e.slug}`}
          actionsWidth={96}
          actions={(e) => (
            <RowActions>
              <IconButton
                icon={e.active ? Archive : ArchiveRestore}
                label={e.active ? "Ritira" : "Ripristina"}
                ariaLabel={`${e.active ? "Ritira" : "Ripristina"} ${e.nameIt}`}
                onClick={() =>
                  void store(
                    { ...e, active: !e.active },
                    e.active ? `${e.nameIt} ritirato.` : `${e.nameIt} ripristinato.`
                  ).catch((error) => {
                    console.error(error)
                    appToast.error(error instanceof Error ? error.message : "Non è stato possibile salvare.")
                  })
                }
              />
              <IconButton
                icon={Pencil}
                label="Modifica"
                ariaLabel={`Modifica ${e.nameIt}`}
                onClick={() => setEditing({ isNew: false, entry: e })}
              />
            </RowActions>
          )}
          empty={
            <EmptyState
              icon={GraduationCap}
              title={ofKind.length ? "Nessuna voce corrisponde" : "Nessuna voce"}
              text={
                ofKind.length
                  ? "Prova con un’altra ricerca."
                  : "Le voci aggiunte qui compaiono nella scheda delle associazioni e nei filtri del sito."
              }
            />
          }
        />
      </PageContent>
      {editing && (
        <CatalogueDialog
          key={`${editing.entry.kind}:${editing.entry.slug}:${editing.isNew}`}
          {...editing}
          onClose={() => setEditing(null)}
          onSave={async (entry) => {
            await store(entry, editing.isNew ? `${entry.nameIt} aggiunto.` : `${entry.nameIt} salvato.`)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function CatalogueDialog({
  entry,
  isNew,
  onClose,
  onSave,
}: {
  entry: CatalogueEntry
  isNew: boolean
  onClose: () => void
  onSave: (entry: CatalogueEntry) => Promise<void>
}) {
  const [value, setValue] = useState(entry)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={isNew ? `Aggiungi ${kindLabel[value.kind].toLowerCase()}` : `Modifica ${value.nameIt}`}
      description={
        value.kind === "programme"
          ? "La chiave segue le etichette dei gruppi: didattica.<scuola>.<livello>.<corso>. Non si cambia dopo la creazione."
          : "La chiave è una parola in minuscolo, come “bovisa”. Non si cambia dopo la creazione."
      }
      noun="voce"
      locale="it"
      dirty={JSON.stringify(value) !== JSON.stringify(entry)}
      submitLabel={isNew ? "Aggiungi" : "Salva"}
      canSubmit={!!value.slug.trim() && !!value.nameIt.trim() && !!value.nameEn.trim()}
      onSubmit={() => onSave({ ...value, slug: value.slug.trim() })}
    >
      {isNew && (
        <RadioCardGroup label="Tipo" value={value.kind} onValueChange={(kind) => setValue({ ...value, kind })}>
          <RadioCard value="programme" label="Corso di studio" />
          <RadioCard value="campus" label="Sede" />
        </RadioCardGroup>
      )}
      {isNew && (
        <TextField
          label="Chiave"
          value={value.slug}
          onChange={(slug) => setValue({ ...value, slug })}
          maxLength={160}
          hint={
            value.kind === "programme"
              ? "Ad esempio didattica.design.triennale.design-della-moda"
              : "Ad esempio piacenza"
          }
        />
      )}
      <TextField
        label="Nome italiano"
        value={value.nameIt}
        onChange={(nameIt) => setValue({ ...value, nameIt })}
        maxLength={200}
      />
      <TextField
        label="Nome inglese"
        value={value.nameEn}
        onChange={(nameEn) => setValue({ ...value, nameEn })}
        maxLength={200}
      />
    </FormDialog>
  )
}
