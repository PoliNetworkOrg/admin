import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  BookOpen,
  Download,
  ExternalLink,
  FileDiff,
  FilePlus2,
  FileText,
  GitBranch,
  Lock,
  ScrollText,
  Upload,
} from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  Chip,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Hint,
  IconButton,
  InlineAlert,
  inlineLink,
  LoadingButton,
  RecordHeader,
  useOpenGeneration,
  RowActions,
  SectionHeading,
  StatusBadge,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { NewDraftDialog, type NewDraftTarget } from "./new-draft-dialog"
import { downloadPdf, PdfDialog, usePdfDialog } from "./pdf-dialog"
import { baseLabel, formatDay, versionOrigin } from "./regulations-format"
import { failureMessage } from "./regulations-hooks"
import { DraftKindMark, DraftStateBadge } from "./regulations-ui"
import type { DocumentInfo, DraftSummary, VersionSummary } from "./regulations.contract"
import { getVersionPdf } from "./regulations.functions"
import { UploadVersionDialog } from "./upload-version-dialog"

/** One line under the title for the kinds whose rules differ from the regolamenti's. */
function kindDescription(document: DocumentInfo) {
  if (document.kind === "consultazione")
    return "Si legge qui e si modifica solo nel repository documents: l'importazione ne registra la nuova versione."
  if (document.origin === "upload") return "Un PDF caricato non si modifica: una nuova versione è un nuovo caricamento."
  if (document.storage === "private")
    return "Si scrive in bozza e si pubblica nella dashboard: non va su GitHub e non si notifica nessuno."
  return undefined
}

/**
 * A document's versions, newest first (the first is in force), and its drafts. What the page offers follows the
 * document's kind: the RRI's full procedure (rettifiche, differences, releases), a documento's drafts and releases, an
 * uploaded PDF's new uploads, or, for sola consultazione, only reading the PDF. Every PDF opens in the viewer.
 */
export function DocumentPage({
  document,
  versions,
  drafts,
}: {
  document: DocumentInfo
  versions: VersionSummary[]
  drafts: DraftSummary[]
}) {
  const canWrite = useCan("regulations:write")
  const canRectify = useCan("regulations:rectify")
  const canManage = useCan("regulations:manage")
  const pdf = useServerFn(getVersionPdf)
  const [uploadOpen, setUploadOpen] = useState(false)
  const uploadGeneration = useOpenGeneration(uploadOpen)
  const rri = document.procedureKey === "rri"
  const consultazione = document.kind === "consultazione"
  const uploaded = document.origin === "upload"
  // Drafts exist for LaTeX documents with a procedure; new ones only while the backend says it's editable.
  const hasDrafts = document.procedure !== null && !uploaded
  const canDraft = canWrite && document.editable
  // Every row keeps the same slots, so the icons line up whatever a version lacks.
  const slots = {
    diff: rri,
    release: document.storage === "repo" && !consultazione,
    branch: canDraft,
  }
  const slotCount = 2 + Number(slots.diff) + Number(slots.release) + Number(slots.branch)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ open: boolean; target: NewDraftTarget }>({
    open: false,
    target: { kind: "modifica", documents: [document] },
  })
  const generation = useOpenGeneration(dialog.open)
  const openDialog = (target: NewDraftTarget) => setDialog({ open: true, target })
  const latest = versions[0] ?? null
  const viewer = usePdfDialog()
  const description = kindDescription(document)

  function view(version: VersionSummary) {
    viewer.show({
      title: `${document.title} · ${version.label}`,
      description: `${version.id === latest?.id ? "In vigore · " : ""}${versionOrigin(version)} · ${formatDay(version.publishedAt)}`,
      load: () => pdf({ data: { versionId: version.id } }),
      failure: "Non è stato possibile aprire il PDF.",
    })
  }

  async function download(version: VersionSummary) {
    setDownloading(version.id)
    try {
      downloadPdf(await pdf({ data: { versionId: version.id } }))
    } catch (caught) {
      console.error(caught)
      appToast.error(failureMessage(caught, "Non è stato possibile scaricare il PDF."))
    } finally {
      setDownloading(null)
    }
  }

  const versionColumns: DataTableColumn<VersionSummary>[] = [
    {
      id: "version",
      label: "Versione",
      fill: true,
      minWidth: 240,
      mobile: "main",
      // The label and "In vigore" on one line, where the origin's 12px line under them can't push into them; a long
      // label truncates and the badge never shrinks.
      cell: (version) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <Hint label={version.label} overflowOnly>
              <span className="min-w-0 truncate font-mono text-[13px]">{version.label}</span>
            </Hint>
            {version.id === latest?.id && <StatusBadge tone="brand">In vigore</StatusBadge>}
          </span>
          <Hint label={versionOrigin(version)} overflowOnly>
            <span className="truncate text-xs leading-4 font-normal text-(--pn-fg-muted)">
              {versionOrigin(version)}
            </span>
          </Hint>
        </span>
      ),
    },
    {
      id: "published",
      label: "Pubblicata",
      width: 120,
      mobile: "meta",
      cell: (version) => <span className="whitespace-nowrap tabular-nums">{formatDay(version.publishedAt)}</span>,
    },
  ]

  const draftColumns: DataTableColumn<DraftSummary>[] = [
    {
      id: "title",
      label: "Bozza",
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (draft) => (
        <span className="flex min-w-0 items-center gap-2">
          <Hint label={draft.title} overflowOnly>
            <span className="truncate font-medium">{draft.title}</span>
          </Hint>
          <DraftKindMark kind={draft.kind} />
        </span>
      ),
    },
    {
      id: "state",
      label: "Stato",
      // "In approvazione" is the widest badge.
      width: 170,
      mobile: "meta",
      cell: (draft) => <DraftStateBadge state={draft.state} />,
    },
    {
      id: "base",
      label: "Parte da",
      width: 220,
      priority: 3,
      mobile: "hidden",
      cell: (draft) => <span className="block truncate">{baseLabel(draft.base)}</span>,
    },
    {
      id: "updated",
      label: "Aggiornata",
      width: 120,
      priority: 2,
      mobile: "meta",
      cell: (draft) => <span className="whitespace-nowrap tabular-nums">{formatDay(draft.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <PageBar
        back={{ label: "documenti", link: { to: "/dashboard/regulations" } }}
        context={document.title}
        right={
          <>
            {consultazione && latest?.pdfAvailable ? (
              <>
                <LoadingButton
                  variant="outline"
                  size="default"
                  icon={Download}
                  pending={downloading === latest.id}
                  onClick={() => void download(latest)}
                >
                  Scarica il PDF
                </LoadingButton>
                <Button className={buttonMotion} onClick={() => view(latest)}>
                  <FileText aria-hidden />
                  Apri il PDF
                </Button>
              </>
            ) : null}
            {uploaded && canManage ? (
              <Button className={buttonMotion} onClick={() => setUploadOpen(true)}>
                <Upload aria-hidden />
                Carica nuova versione
              </Button>
            ) : null}
            {rri && canRectify && latest && document.editable && (
              <Button
                variant="outline"
                className={buttonMotion}
                onClick={() =>
                  openDialog({
                    kind: "rettifica",
                    documents: [
                      {
                        documentKey: document.key,
                        title: document.title,
                        latestVersionId: latest.id,
                        latestVersionLabel: latest.label,
                      },
                    ],
                  })
                }
              >
                Nuova rettifica
              </Button>
            )}
            {canDraft && (
              <Button
                className={buttonMotion}
                onClick={() => openDialog({ kind: "modifica", documents: [document], documentKey: document.key })}
              >
                <FilePlus2 aria-hidden />
                Nuova bozza
              </Button>
            )}
          </>
        }
      />
      <PageContent>
        <div className="flex flex-col gap-8">
          <RecordHeader
            title={document.title}
            badge={
              document.storage === "private" ? (
                <Chip>
                  <Lock aria-hidden className="size-3" />
                  Privato
                </Chip>
              ) : consultazione ? (
                <Chip>
                  <BookOpen aria-hidden className="size-3" />
                  Sola consultazione
                </Chip>
              ) : undefined
            }
            meta={
              latest
                ? `In vigore: versione ${latest.label} del ${formatDay(latest.publishedAt)} · ${versionOrigin(latest)}`
                : "Nessuna versione pubblicata"
            }
            description={description}
          />
          {document.status !== "active" ? (
            <InlineAlert tone={document.status === "failed" ? "danger" : "info"}>
              {document.status === "failed"
                ? (document.creation?.error ?? "La creazione del documento non è riuscita.")
                : "Il documento è in creazione: si potrà usare appena la sua pull request viene unita."}{" "}
              {document.creation?.prUrl ? (
                <a href={document.creation.prUrl} target="_blank" rel="noreferrer" className={inlineLink}>
                  Apri la pull request
                </a>
              ) : null}
            </InlineAlert>
          ) : null}
          <section className="flex flex-col gap-3" aria-labelledby="versions-heading">
            <SectionHeading
              id="versions-heading"
              title={uploaded ? "Versioni caricate" : "Versioni pubblicate"}
              count={versions.length}
            />
            <DataTable
              locale="it"
              label={uploaded ? "Versioni caricate" : "Versioni pubblicate"}
              columns={versionColumns}
              rows={versions}
              getRowId={(version) => version.id}
              actionsWidth={16 + slotCount * 40}
              actions={(version) => (
                <RowActions>
                  {version.pdfAvailable ? (
                    <>
                      <IconButton
                        label="Apri il PDF"
                        ariaLabel={`Apri il PDF della versione ${version.label}`}
                        icon={FileText}
                        onClick={() => view(version)}
                      />
                      <IconButton
                        label="Scarica il PDF"
                        ariaLabel={`Scarica il PDF della versione ${version.label}`}
                        icon={Download}
                        pending={downloading === version.id}
                        onClick={() => void download(version)}
                      />
                    </>
                  ) : (
                    <>
                      <EmptySlot />
                      <EmptySlot />
                    </>
                  )}
                  {!slots.diff ? null : version.draftId ? (
                    <IconButton
                      label="Differenze"
                      ariaLabel={`Differenze della versione ${version.label}`}
                      icon={FileDiff}
                      nativeButton={false}
                      render={
                        <Link to="/dashboard/regulations/drafts/$draftId/diff" params={{ draftId: version.draftId }} />
                      }
                    />
                  ) : (
                    <EmptySlot />
                  )}
                  {!slots.release ? null : version.releaseUrl ? (
                    <IconButton
                      label="Apri la release su GitHub"
                      ariaLabel={`Apri la release ${version.label} su GitHub`}
                      icon={ExternalLink}
                      nativeButton={false}
                      render={<a href={version.releaseUrl} target="_blank" rel="noreferrer" />}
                    />
                  ) : (
                    <EmptySlot />
                  )}
                  {slots.branch && (
                    <IconButton
                      label="Nuova bozza da qui"
                      ariaLabel={`Nuova bozza dalla versione ${version.label}`}
                      icon={GitBranch}
                      onClick={() =>
                        openDialog({
                          kind: "modifica",
                          documents: [document],
                          documentKey: document.key,
                          from: { kind: "version", id: version.id },
                        })
                      }
                    />
                  )}
                </RowActions>
              )}
              empty={
                <EmptyState
                  icon={ScrollText}
                  title="Nessuna versione"
                  text={
                    uploaded
                      ? "Le versioni compaiono qui quando si carica un PDF."
                      : rri
                        ? "Le versioni compaiono qui quando vengono emanate o importate dal repository."
                        : "Le versioni compaiono qui quando vengono pubblicate o importate dal repository."
                  }
                />
              }
            />
          </section>
          {hasDrafts ? (
            <section className="flex flex-col gap-3" aria-labelledby="drafts-heading">
              <SectionHeading id="drafts-heading" title="Bozze" count={drafts.length} />
              <DataTable
                locale="it"
                label="Bozze"
                columns={draftColumns}
                rows={drafts}
                getRowId={(draft) => draft.id}
                rowLabel={(draft) => draft.title}
                rowHref={(draft) => `/dashboard/regulations/drafts/${draft.id}`}
                empty={
                  <EmptyState
                    icon={ScrollText}
                    title="Nessuna bozza"
                    text="Una bozza parte da una versione pubblicata o da un'altra bozza."
                  />
                }
              />
            </section>
          ) : null}
        </div>
      </PageContent>
      <PdfDialog {...viewer.props} />
      {uploaded && canManage ? (
        <UploadVersionDialog
          key={`upload-${uploadGeneration}`}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          document={document}
        />
      ) : null}
      <NewDraftDialog
        key={generation}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        target={dialog.target}
      />
    </>
  )
}

/** Keeps a missing action's place on desktop; stacked cards drop it. */
function EmptySlot() {
  return <span aria-hidden className="size-9 shrink-0 max-shell:hidden" />
}
