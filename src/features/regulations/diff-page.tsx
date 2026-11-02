import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Download, FileDiff, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  LoadingButton,
  SectionCard,
  SectionHeading,
  Spinner,
  StatusBadge,
} from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { DiffArticle } from "./diff-article"
import { formatDayTime } from "./regulations-format"
import { downloadPdf, failureMessage, useRefreshAfter } from "./regulations-hooks"
import { regenerateDiff } from "./regulations-manage.functions"
import type { Diff, Draft } from "./regulations.contract"
import { getDiff, getDiffPdf } from "./regulations.functions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const
const POLL_MS = 2000

/**
 * The differences of a draft from its base, as the Soci receive them: the categories the model wrote (first page of
 * the PDF), then old and new side by side for the changed articles only, with the words that changed marked. Not
 * editable: `regulations:manage` may only regenerate it, until the notification goes out.
 */
export function DiffPage({ draft, diff: loaded }: { draft: Draft; diff: Diff }) {
  const router = useRouter()
  const refresh = useRefreshAfter()
  const fetchDiff = useServerFn(getDiff)
  const fetchPdf = useServerFn(getDiffPdf)
  const regenerate = useServerFn(regenerateDiff)
  const [diff, setDiff] = useState(loaded)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => setDiff(loaded), [loaded])

  // The model takes a while: ask again until the generation ends.
  useEffect(() => {
    if (diff.status !== "pending") return
    let current = true
    const timer = setInterval(() => {
      fetchDiff({ data: { draftId: draft.id } }).then(
        (next) => {
          if (!current) return
          setDiff(next)
          if (next.status !== "pending") router.invalidate().catch((error) => console.error(error))
        },
        (error) => console.error(error)
      )
    }, POLL_MS)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [diff.status, draft.id, fetchDiff, router])

  async function download() {
    setDownloading(true)
    setPdfError(null)
    try {
      downloadPdf(await fetchPdf({ data: { draftId: draft.id } }))
    } catch (caught) {
      console.error(caught)
      setPdfError(failureMessage(caught, "Non è stato possibile scaricare il PDF delle differenze. Riprova."))
    } finally {
      setDownloading(false)
    }
  }

  async function confirmRegenerate() {
    try {
      await regenerate({ data: { draftId: draft.id } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile rigenerare le differenze. Riprova."), {
        cause: caught,
      })
    }
    await refresh("Rigenerazione avviata.")
  }

  const canRegenerate = draft.can.regenerateDiff && !diff.locked && diff.status !== "pending"
  const byId = new Map(diff.articles.map((article) => [article.id, article]))
  const meta = [
    diff.generatedAt ? `Generate il ${formatDayTime(diff.generatedAt)}` : null,
    diff.generatedBy ? `da ${diff.generatedBy.name}` : null,
    diff.generation > 1 ? `${diff.generation}ª generazione` : null,
    diff.provider && diff.model ? `${diff.provider} · ${diff.model}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <PageBar
        back={BACK}
        crumb="Bozze"
        context={draft.title}
        right={
          diff.status === "ready" ? (
            <>
              {canRegenerate ? (
                <Button variant="outline" className={buttonMotion} onClick={() => setRegenerateOpen(true)}>
                  <RefreshCw data-icon="inline-start" />
                  Rigenera
                </Button>
              ) : null}
              <LoadingButton icon={Download} pending={downloading} onClick={() => void download()}>
                Scarica PDF
              </LoadingButton>
            </>
          ) : undefined
        }
      />
      <PageContent>
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px]/8 font-semibold tracking-[-0.015em] text-(--pn-fg) shell:text-[28px]/9">
                Differenze
              </h1>
              {diff.locked ? <StatusBadge tone="neutral">Notificate</StatusBadge> : null}
            </div>
            <p className="text-[14px] text-(--pn-fg-muted)">
              Da <span className="font-medium text-(--pn-fg)">{diff.baseLabel}</span> a{" "}
              <span className="font-medium text-(--pn-fg)">{draft.title}</span>
              {meta ? <span className="block text-[13px]">{meta}</span> : null}
            </p>
          </header>

          {pdfError ? <InlineAlert>{pdfError}</InlineAlert> : null}

          {diff.status === "none" ? (
            <SectionCard>
              <EmptyState
                icon={FileDiff}
                title="Nessuna differenza generata"
                text="Le differenze si generano quando la bozza va in approvazione."
              />
            </SectionCard>
          ) : diff.status === "pending" ? (
            <InlineAlert tone="info" action={<Spinner className="size-4" />}>
              Il riepilogo è in preparazione: questa pagina si aggiorna da sola.
            </InlineAlert>
          ) : diff.status === "failed" ? (
            <InlineAlert
              action={
                canRegenerate ? (
                  <Button size="sm" variant="outline" className={buttonMotion} onClick={() => setRegenerateOpen(true)}>
                    Rigenera
                  </Button>
                ) : undefined
              }
            >
              La generazione non è riuscita{diff.error ? `: ${diff.error}` : "."}
            </InlineAlert>
          ) : (
            <>
              <SectionCard title="Riepilogo" count={diff.categories.length}>
                {diff.categories.length === 0 && diff.otherChanges.length === 0 ? (
                  <p className="text-[14px] text-(--pn-fg-muted)">Nessuna differenza dalla base.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-(--pn-line)">
                    {diff.categories.map((category) => (
                      <section key={category.title} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                        <h2 className="text-[15px] font-semibold text-(--pn-fg)">{category.title}</h2>
                        <p className="text-[14px] text-pretty text-(--pn-fg)">{category.summary}</p>
                        {category.articleIds.length ? (
                          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                            {category.articleIds.map((id) => {
                              const article = byId.get(id)
                              return (
                                <a
                                  key={id}
                                  href={`#articolo-${id}`}
                                  className="text-(--pn-accent) underline-offset-2 hover:underline"
                                >
                                  {articleName(article?.newLabel ?? article?.oldLabel ?? id)}
                                </a>
                              )
                            })}
                          </p>
                        ) : null}
                      </section>
                    ))}
                    {diff.otherChanges.length ? (
                      <section className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                        <h2 className="text-[15px] font-semibold text-(--pn-fg)">Altre modifiche</h2>
                        <ul className="list-disc pl-5 text-[14px] text-(--pn-fg)">
                          {diff.otherChanges.map((change) => (
                            <li key={change}>{change}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </div>
                )}
              </SectionCard>

              {diff.articles.length ? (
                <section className="flex flex-col gap-3" aria-labelledby="diff-articles">
                  <SectionHeading id="diff-articles" title="Articoli modificati" count={diff.articles.length} />
                  {diff.articles.map((article) => (
                    <DiffArticle key={article.id} article={article} />
                  ))}
                </section>
              ) : null}
            </>
          )}
        </div>
      </PageContent>
      <ConfirmDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Rigenerare le differenze?"
        description="Il modello riscrive il riepilogo per categorie e quello attuale si sostituisce. Il confronto degli articoli non cambia. Si può rigenerare fino alla notifica."
        confirmLabel="Rigenera"
        cancelLabel="Annulla"
        tone="primary"
        icon={RefreshCw}
        onConfirm={confirmRegenerate}
      />
    </>
  )
}

/** "Articolo 1.3 — Notifiche" out of "Regolamento Fondamentale › Articolo 1.3 — Notifiche". */
export function articleName(label: string) {
  return label.split(" › ").at(-1) ?? label
}
