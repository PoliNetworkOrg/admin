import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Landmark, RefreshCw } from "lucide-react"
import { useState } from "react"

import { buttonMotion, ConfirmDialog, EmptyState, NavCard } from "@/components/primitives"
import { PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { versionOrigin } from "./regulations-format"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { syncRegulationDocuments } from "./regulations-manage.functions"
import type { DocumentInfo } from "./regulations.contract"

/**
 * Regolamenti › Documenti: each governing document (v1: the Raccolta dei Regolamenti Interni) with its latest
 * version, open drafts and the one in approvazione. A card opens the document's versions and drafts.
 */
export function DocumentsPage({ documents }: { documents: DocumentInfo[] }) {
  const canManage = useCan("regulations:manage")
  const sync = useServerFn(syncRegulationDocuments)
  const refresh = useRefreshAfter()
  const [syncOpen, setSyncOpen] = useState(false)

  return (
    <>
      <PageBar
        description="I documenti dell'Associazione, con le versioni in vigore e le bozze in lavorazione."
        right={
          canManage ? (
            <Button variant="outline" className={buttonMotion} onClick={() => setSyncOpen(true)}>
              <RefreshCw aria-hidden />
              Importa da legal
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {documents.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title="Nessun documento"
            text="I documenti arrivano dal repository legal: importali per iniziare."
          />
        ) : (
          <div className="grid gap-3 shell:grid-cols-2">
            {documents.map((document) => (
              <NavCard
                key={document.key}
                title={document.title}
                description={[
                  document.latestVersion
                    ? `Versione ${document.latestVersion.label} · ${versionOrigin(document.latestVersion)}`
                    : "Nessuna versione pubblicata",
                  document.openDrafts === 1 ? "1 bozza aperta" : `${document.openDrafts} bozze aperte`,
                  document.inApproval ? `In approvazione: ${document.inApproval.title}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                render={
                  <Link to="/dashboard/regulations/documents/$documentKey" params={{ documentKey: document.key }} />
                }
              />
            ))}
          </div>
        )}
      </PageContent>
      <ConfirmDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        tone="primary"
        icon={RefreshCw}
        title="Importare i documenti da legal?"
        description="Legge legal.json e i sorgenti attuali del repository e li registra come versione pubblicata dei documenti nuovi o cambiati."
        confirmLabel="Importa"
        cancelLabel="Annulla"
        onConfirm={async () => {
          try {
            await sync()
          } catch (caught) {
            console.error(caught)
            throw new Error(failureMessage(caught, "Non è stato possibile importare i documenti."), { cause: caught })
          }
          await refresh("Documenti importati.")
        }}
      />
    </>
  )
}
