import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  FileText,
  GitPullRequest,
  Landmark,
  Lock,
  RefreshCw,
  RotateCcw,
} from "lucide-react"
import { useEffect, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineAlert,
  SectionHeading,
  StatusBadge,
  useOpenGeneration,
} from "@/components/primitives"
import { PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { NewDocumentDialog } from "./new-document-dialog"
import { DOCUMENT_KIND_LABELS, formatDay } from "./regulations-format"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { createRegulationDocument, syncRegulationDocuments } from "./regulations-manage.functions"
import { DOCUMENT_KINDS, type DocumentInfo, type DocumentKind, type SyncResult } from "./regulations.contract"

/** One line under each section's title: the kinds are easy to confuse. */
const KIND_DESCRIPTIONS = {
  regolamento: "La Raccolta dei Regolamenti Interni e gli altri documenti scritti in articoli e commi.",
  generale: "Pubblici nel repository documents: si modificano in bozza e si pubblicano con una release.",
  privato: "Solo nella dashboard, mai su GitHub: documenti scritti da un modello e PDF caricati.",
  consultazione: "Si leggono qui e si modificano solo nel repository documents.",
} satisfies Record<DocumentKind, string>

const KIND_ICONS = {
  regolamento: Landmark,
  generale: FileText,
  privato: Lock,
  consultazione: BookOpen,
} satisfies Record<DocumentKind, typeof Landmark>

const CREATION_POLL_MS = 15_000

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * Regolamenti › Documenti: every document of the Associazione, grouped by kind (regolamenti, documenti generali,
 * privati, sola consultazione), each with its version in force and open drafts. A card opens the document; one still
 * being created on the repository shows its pull request instead.
 */
export function DocumentsPage({ documents }: { documents: DocumentInfo[] }) {
  const canManage = useCan("regulations:manage")
  const sync = useServerFn(syncRegulationDocuments)
  const create = useServerFn(createRegulationDocument)
  const refresh = useRefreshAfter()
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const generation = useOpenGeneration(newOpen)
  const [retrying, setRetrying] = useState<DocumentInfo | null>(null)
  const [retryOpen, setRetryOpen] = useState(false)

  // A repository document in creation turns active when its pull request merges: look again now and then.
  const router = useRouter()
  const creating = documents.some((document) => document.status === "creating")
  useEffect(() => {
    if (!creating) return
    const timer = setInterval(() => {
      router.invalidate().catch((error) => console.error(error))
    }, CREATION_POLL_MS)
    return () => clearInterval(timer)
  }, [creating, router])

  const groups = DOCUMENT_KINDS.map((kind) => ({
    kind,
    // Usable documents first, then the ones still in creation, each by title.
    documents: documents
      .filter((document) => document.kind === kind)
      .sort(
        (a, b) => Number(a.status !== "active") - Number(b.status !== "active") || a.title.localeCompare(b.title, "it")
      ),
  })).filter((group) => group.documents.length > 0)

  async function runSync() {
    let result: SyncResult
    try {
      result = await sync()
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile importare i documenti."), { cause: caught })
    }
    setSyncResult(result)
    const changes = [
      result.imported.length ? plural(result.imported.length, "documento nuovo", "documenti nuovi") : null,
      result.updated.length ? plural(result.updated.length, "aggiornato", "aggiornati") : null,
    ].filter(Boolean)
    await refresh(
      changes.length
        ? `Importazione completata: ${changes.join(", ")}.`
        : "Importazione completata: nessun documento nuovo o cambiato."
    )
  }

  async function runRetry() {
    if (!retrying?.template) return
    try {
      await create({
        data: { key: retrying.key, title: retrying.title, template: retrying.template, storage: "repo" },
      })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile creare il documento. Riprova."), { cause: caught })
    }
    await refresh("Pull request aperta di nuovo.")
  }

  return (
    <>
      <PageBar
        description="I documenti dell'Associazione, con le versioni in vigore e le bozze in lavorazione."
        right={
          canManage ? (
            <>
              <Button variant="outline" className={buttonMotion} onClick={() => setSyncOpen(true)}>
                <RefreshCw aria-hidden />
                Importa dal repository
              </Button>
              <Button className={buttonMotion} onClick={() => setNewOpen(true)}>
                <FilePlus2 aria-hidden />
                Nuovo documento
              </Button>
            </>
          ) : undefined
        }
      />
      <PageContent>
        <div className="flex flex-col gap-8">
          {syncResult && syncResult.skipped.length > 0 ? <SkippedAlert result={syncResult} /> : null}
          {groups.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="Nessun documento"
              text="I documenti arrivano dal repository documents: importali per iniziare."
            />
          ) : (
            groups.map((group) => (
              <section key={group.kind} className="flex flex-col gap-3" aria-labelledby={`kind-${group.kind}`}>
                <SectionHeading
                  id={`kind-${group.kind}`}
                  title={DOCUMENT_KIND_LABELS[group.kind]}
                  count={group.documents.length}
                  description={KIND_DESCRIPTIONS[group.kind]}
                />
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))] gap-3">
                  {group.documents.map((document) => (
                    <li key={document.key} className="flex min-w-0">
                      {document.status === "active" ? (
                        <DocumentCard document={document} />
                      ) : (
                        <CreationCard
                          document={document}
                          onRetry={
                            canManage && document.status === "failed" && document.template
                              ? () => {
                                  setRetrying(document)
                                  setRetryOpen(true)
                                }
                              : null
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </PageContent>
      <ConfirmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        tone="primary"
        icon={RefreshCw}
        title="Importare i documenti dal repository?"
        description="Legge documents.json e i sorgenti attuali del repository documents: registra i documenti nuovi e una nuova versione di quelli di sola consultazione cambiati. Le bozze aperte non si toccano."
        confirmLabel="Importa"
        cancelLabel="Annulla"
        onConfirm={runSync}
      />
      <ConfirmDialog
        open={retryOpen}
        onOpenChange={setRetryOpen}
        tone="primary"
        icon={GitPullRequest}
        title="Creare di nuovo il documento?"
        description={`Apre una nuova pull request sul repository documents per «${retrying?.title ?? ""}», con lo stesso titolo, chiave e modello. Si unisce da sola appena la CI passa.`}
        confirmLabel="Crea di nuovo"
        cancelLabel="Annulla"
        onConfirm={runRetry}
      />
      {canManage ? (
        <NewDocumentDialog
          key={generation}
          open={newOpen}
          onOpenChange={setNewOpen}
          takenKeys={documents.map((document) => document.key)}
        />
      ) : null}
    </>
  )
}

/** What the last import left out and why: it stays until the page is left, as it may need action. */
function SkippedAlert({ result }: { result: SyncResult }) {
  return (
    <InlineAlert tone="warning">
      <p className="font-medium">
        {plural(result.skipped.length, "documento non importato", "documenti non importati")}:
      </p>
      <ul className="mt-0.5 flex flex-col gap-0.5">
        {result.skipped.map((item) => (
          <li key={item.key}>
            <span className="font-mono text-xs">{item.key}</span> — {item.reason}
          </li>
        ))}
      </ul>
    </InlineAlert>
  )
}

const cardSurface =
  "flex w-full min-w-0 items-center gap-3 rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface) px-4 py-3"

function KindTile({ icon: Icon }: { icon: typeof Landmark }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-(--pn-r-4) border border-(--pn-line) text-(--pn-fg-muted)"
    >
      <Icon strokeWidth={1.75} className="size-4.5" />
    </span>
  )
}

/** Keeps a short phrase on one line ("2 bozze aperte", "del 13/03/2026") while the sentence around it wraps. */
const keep = (text: string) => text.replaceAll(" ", "\u00a0")

/** The version in force and the drafts, in one line that wraps between phrases. */
function documentMeta(document: DocumentInfo) {
  const latest = document.latestVersion
  const parts = [
    latest
      ? `${document.origin === "upload" ? "PDF caricato, " : ""}${keep(`versione ${latest.label}`)} ${keep(`del ${formatDay(latest.publishedAt)}`)}`
      : "Nessuna versione pubblicata",
    document.openDrafts ? keep(plural(document.openDrafts, "bozza aperta", "bozze aperte")) : null,
    document.inApproval ? keep("una in approvazione") : null,
  ].filter((part) => part !== null)
  const line = parts.join("\u00a0· ")
  return line.charAt(0).toUpperCase() + line.slice(1)
}

/** An active document: the whole card opens it. */
function DocumentCard({ document }: { document: DocumentInfo }) {
  return (
    <Link
      to="/dashboard/regulations/documents/$documentKey"
      params={{ documentKey: document.key }}
      className={cn(cardSurface, "min-h-16 transition-[background-color] duration-120 hover:bg-(--pn-hover)")}
    >
      <KindTile icon={KIND_ICONS[document.kind]} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm leading-5 font-medium text-(--pn-fg)">{document.title}</span>
        <span className="text-xs leading-4 text-pretty text-(--pn-fg-muted)">{documentMeta(document)}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
    </Link>
  )
}

/**
 * A repository document created from the dashboard whose pull request hasn't merged ("In creazione"), or failed:
 * nothing to open yet, so the card links the pull request and says what went wrong.
 */
function CreationCard({ document, onRetry }: { document: DocumentInfo; onRetry: (() => void) | null }) {
  const creation = document.creation
  const failed = document.status === "failed"
  const pr = creation?.prNumber ? `Pull request #${creation.prNumber}` : "Pull request"
  const prLink = creation?.prUrl ? (
    <IconButton
      label="Apri la pull request"
      ariaLabel={`Apri la ${pr.toLowerCase()} di «${document.title}» su GitHub`}
      icon={ExternalLink}
      nativeButton={false}
      render={<a href={creation.prUrl} target="_blank" rel="noreferrer" />}
    />
  ) : null
  return (
    <div className={cn(cardSurface, "min-h-16 flex-wrap")}>
      <KindTile icon={GitPullRequest} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 text-sm leading-5 font-medium break-words text-(--pn-fg)">{document.title}</span>
          <StatusBadge tone={failed ? "danger" : creation?.error ? "warning" : "brand"} className="shrink-0">
            {failed ? "Non creato" : "In creazione"}
          </StatusBadge>
        </div>
        {creation?.error ? (
          <p className="text-xs leading-4 text-pretty text-(--pn-danger-fg)">{creation.error}</p>
        ) : (
          <p className="text-xs leading-4 text-pretty text-(--pn-fg-muted)">
            {creation
              ? `${keep(pr)} di ${keep(creation.startedBy.name)}, ${formatDay(creation.startedAt)}: compare qui appena viene unita.`
              : "In attesa della pull request."}
          </p>
        )}
      </div>
      {onRetry ? (
        // A failed creation's actions take their own row, under the text, so the error keeps the card's width.
        <div className="flex basis-full items-center gap-1 pl-12">
          <Button variant="outline" size="sm" className={buttonMotion} onClick={onRetry}>
            <RotateCcw aria-hidden />
            Crea di nuovo
          </Button>
          {prLink}
        </div>
      ) : (
        <div className="flex shrink-0 items-center">{prLink}</div>
      )}
    </div>
  )
}
