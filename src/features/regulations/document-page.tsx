import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ExternalLink, FileDiff, FileDown, FilePlus2, GitBranch, ScrollText } from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  RecordHeader,
  useOpenGeneration,
  RowActions,
  SectionHeading,
  StatusBadge,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { NewDraftDialog, type NewDraftTarget } from "./new-draft-dialog"
import { baseLabel, formatDay, versionOrigin } from "./regulations-format"
import { downloadPdf, failureMessage } from "./regulations-hooks"
import { DraftKindMark, DraftStateBadge } from "./regulations-ui"
import type { DocumentInfo, DraftSummary, VersionSummary } from "./regulations.contract"
import { getVersionPdf } from "./regulations.functions"

/**
 * A document's published versions, newest first (the first is in force), and its drafts. Versions carry their
 * official PDF, release and differences; drafts open in the editor.
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
  const pdf = useServerFn(getVersionPdf)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ open: boolean; target: NewDraftTarget }>({
    open: false,
    target: { kind: "modifica", documents: [document] },
  })
  const generation = useOpenGeneration(dialog.open)
  const openDialog = (target: NewDraftTarget) => setDialog({ open: true, target })
  const latest = versions[0] ?? null

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
      width: 180,
      mobile: "main",
      cell: (version) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-[13px]">{version.label}</span>
          {version.id === latest?.id && <StatusBadge tone="brand">In vigore</StatusBadge>}
        </span>
      ),
    },
    {
      id: "origin",
      label: "Origine",
      fill: true,
      minWidth: 240,
      mobile: "full",
      cell: (version) => <span className="block truncate">{versionOrigin(version)}</span>,
    },
    {
      id: "published",
      label: "Pubblicata",
      width: 120,
      priority: 2,
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
          <span className="truncate font-medium">{draft.title}</span>
          <DraftKindMark kind={draft.kind} />
        </span>
      ),
    },
    {
      id: "state",
      label: "Stato",
      width: 150,
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
            {canRectify && latest && (
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
            {canWrite && (
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
            meta={
              latest ? `In vigore: versione ${latest.label} · ${versionOrigin(latest)}` : "Nessuna versione pubblicata"
            }
          />
          <section className="flex flex-col gap-3" aria-labelledby="versions-heading">
            <SectionHeading id="versions-heading" title="Versioni pubblicate" count={versions.length} />
            <DataTable
              label="Versioni pubblicate"
              columns={versionColumns}
              rows={versions}
              getRowId={(version) => version.id}
              actionsWidth={176}
              actions={(version) => (
                <RowActions>
                  {version.pdfAvailable && (
                    <IconButton
                      label="Scarica PDF"
                      ariaLabel={`Scarica il PDF della versione ${version.label}`}
                      icon={FileDown}
                      pending={downloading === version.id}
                      onClick={() => void download(version)}
                    />
                  )}
                  {version.releaseUrl && (
                    <IconButton
                      label="Apri la release"
                      ariaLabel={`Apri la release ${version.label}`}
                      icon={ExternalLink}
                      nativeButton={false}
                      render={<a href={version.releaseUrl} target="_blank" rel="noreferrer" />}
                    />
                  )}
                  {version.draftId && (
                    <IconButton
                      label="Differenze"
                      ariaLabel={`Differenze della versione ${version.label}`}
                      icon={FileDiff}
                      nativeButton={false}
                      render={
                        <Link to="/dashboard/regulations/drafts/$draftId/diff" params={{ draftId: version.draftId }} />
                      }
                    />
                  )}
                  {canWrite && (
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
                  text="Le versioni compaiono qui quando vengono emanate o importate da legal."
                />
              }
            />
          </section>
          <section className="flex flex-col gap-3" aria-labelledby="drafts-heading">
            <SectionHeading id="drafts-heading" title="Bozze" count={drafts.length} />
            <DataTable
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
        </div>
      </PageContent>
      <NewDraftDialog
        key={generation}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        target={dialog.target}
      />
    </>
  )
}
