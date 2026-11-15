import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { GitMerge } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  EmptyState,
  InlineAlert,
  LoadingButton,
  SectionCard,
  SectionHeading,
  SelectField,
  Spinner,
  StatusBadge,
  type StatusTone,
} from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"

import { type Choice, ConflictCard } from "./merge-conflict"
import { failureMessage } from "./regulations-hooks"
import { applyMerge } from "./regulations-write.functions"
import type { Draft, DraftSummary, MergePreview, VersionSummary } from "./regulations.contract"
import { getMergePreview } from "./regulations.functions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

const CHANGES = {
  added: { label: "Aggiunto", tone: "success" },
  removed: { label: "Rimosso", tone: "danger" },
  modified: { label: "Modificato", tone: "warning" },
  moved: { label: "Spostato", tone: "brand" },
} satisfies Record<MergePreview["applied"][number]["change"], { label: string; tone: StatusTone }>

type Source = { kind: "draft" | "version"; id: string }

function parseSource(value: string | null): Source | null {
  const match = value?.match(/^(draft|version):(.+)$/)
  return match ? { kind: match[1] === "draft" ? "draft" : "version", id: match[2] } : null
}

/**
 * Merges another draft (a tavolo di lavoro) or a published version into this draft: a 3-way merge per structure
 * node against their common base. Different commi merge on their own; the same node changed on both sides is a
 * conflict, settled here side by side. Nothing changes until "Unisci"; the backend saves a snapshot first.
 */
export function MergePage({
  draft,
  drafts,
  versions,
  from,
}: {
  draft: Draft
  drafts: DraftSummary[]
  versions: VersionSummary[]
  from: string | null
}) {
  const navigate = useNavigate()
  const preview = useServerFn(getMergePreview)
  const apply = useServerFn(applyMerge)
  const source = useMemo(() => parseSource(from), [from])
  const [result, setResult] = useState<{ key: string; preview: MergePreview } | { key: string; error: string } | null>(
    null
  )
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  const options = [
    ...drafts.map((other) => ({ value: `draft:${other.id}`, label: `Bozza: ${other.title}` })),
    ...versions.map((version) => ({ value: `version:${version.id}`, label: `Versione ${version.label}` })),
  ]
  const sourceName = source
    ? source.kind === "draft"
      ? (drafts.find((other) => other.id === source.id)?.title ?? "L'altra bozza")
      : `Versione ${versions.find((version) => version.id === source.id)?.label ?? source.id}`
    : ""

  useEffect(() => {
    if (!source) return
    let current = true
    const key = `${source.kind}:${source.id}`
    preview({ data: { targetDraftId: draft.id, source } }).then(
      (next) => {
        if (!current) return
        setResult({ key, preview: next })
        setChoices({})
      },
      (caught) => {
        console.error(caught)
        if (current)
          setResult({ key, error: failureMessage(caught, "Non è stato possibile calcolare l'unione. Riprova.") })
      }
    )
    return () => {
      current = false
    }
  }, [source, draft.id, preview])

  const current = result && result.key === from ? result : null
  const plan = current && "preview" in current ? current.preview : null
  const resolved = plan ? plan.conflicts.filter((conflict) => choices[conflict.nodeId]).length : 0
  const ready = plan !== null && plan.blockedBy === null && resolved === plan.conflicts.length
  const nothing = plan !== null && plan.applied.length === 0 && plan.conflicts.length === 0

  async function merge() {
    if (!plan || !source || !ready) return
    setApplying(true)
    setApplyError(null)
    try {
      await apply({
        data: {
          targetDraftId: draft.id,
          source,
          resolutions: Object.fromEntries(
            plan.conflicts.map((conflict) => {
              const choice = choices[conflict.nodeId]
              return [conflict.nodeId, choice.kind === "custom" ? { text: choice.text } : choice.kind]
            })
          ),
        },
      })
    } catch (caught) {
      console.error(caught)
      setApplyError(failureMessage(caught, "Non è stato possibile unire. Riprova."))
      setApplying(false)
      return
    }
    await navigate({ to: "/dashboard/regulations/drafts/$draftId", params: { draftId: draft.id } })
    appToast.success(`${sourceName} unita a «${draft.title}».`)
  }

  return (
    <>
      <PageBar back={BACK} crumb="Bozze" context={draft.title} />
      <PageContent>
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-[24px]/8 font-semibold tracking-[-0.015em] text-(--pn-fg) shell:text-[28px]/9">
              Unisci in «{draft.title}»
            </h1>
            <p className="text-[14px] text-pretty text-(--pn-fg-muted)">
              Le modifiche dell'altra bozza entrano in questa. Commi diversi si uniscono da soli; dove entrambe hanno
              cambiato lo stesso punto scegli tu. Prima di unire si salva una versione nella cronologia.
            </p>
          </header>

          {!draft.can.merge ? (
            <InlineAlert tone="warning">
              Questa bozza non può ricevere un'unione ora: si unisce solo in bozza.
            </InlineAlert>
          ) : null}

          <div className="flex max-w-[480px] flex-col gap-1.5">
            <label htmlFor="merge-source" className="text-[13px] font-medium text-(--pn-fg)">
              Da unire
            </label>
            <SelectField
              id="merge-source"
              value={from && options.some((option) => option.value === from) ? from : null}
              options={options}
              placeholder="Scegli una bozza o una versione"
              onChange={(value) =>
                void navigate({
                  to: "/dashboard/regulations/drafts/$draftId/merge",
                  params: { draftId: draft.id },
                  search: { from: value },
                  replace: true,
                })
              }
            />
          </div>

          {!source ? (
            <SectionCard>
              <EmptyState
                icon={GitMerge}
                title="Scegli cosa unire"
                text="Un'altra bozza dello stesso documento, o una versione pubblicata uscita dopo la base di questa bozza."
              />
            </SectionCard>
          ) : current === null ? (
            <p className="flex items-center gap-2 text-[14px] text-(--pn-fg-muted)">
              <Spinner className="size-4" /> Calcolo dell'unione…
            </p>
          ) : "error" in current ? (
            <InlineAlert>{current.error}</InlineAlert>
          ) : plan ? (
            <>
              <p className="text-[13px] text-(--pn-fg-muted)">
                Calcolata rispetto a <span className="font-medium text-(--pn-fg)">{plan.baseLabel}</span>, la base
                comune.
              </p>
              {plan.blockedBy ? <InlineAlert>{plan.blockedBy}</InlineAlert> : null}
              {plan.warnings.map((warning) => (
                <InlineAlert key={warning} tone="warning">
                  {warning}
                </InlineAlert>
              ))}
              {nothing ? (
                <InlineAlert tone="info">
                  Niente da unire: {sourceName} non ha modifiche che questa bozza non abbia.
                </InlineAlert>
              ) : null}

              {plan.applied.length ? (
                <SectionCard title="Si uniscono da sole" count={plan.applied.length} padding="flush">
                  <ul className="flex flex-col divide-y divide-(--pn-line)">
                    {plan.applied.map((change) => (
                      <li key={change.nodeId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="min-w-0 truncate text-[14px] text-(--pn-fg)">{change.label}</span>
                        <StatusBadge tone={CHANGES[change.change].tone}>{CHANGES[change.change].label}</StatusBadge>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}

              {plan.conflicts.length ? (
                <section className="flex flex-col gap-3" aria-labelledby="merge-conflicts">
                  <SectionHeading
                    id="merge-conflicts"
                    title="Conflitti"
                    count={plan.conflicts.length}
                    description="Lo stesso punto è cambiato in entrambe: scegli quale testo tenere."
                  />
                  {plan.conflicts.map((conflict) => (
                    <ConflictCard
                      key={conflict.nodeId}
                      conflict={conflict}
                      sourceName={sourceName}
                      choice={choices[conflict.nodeId] ?? null}
                      onChoice={(choice) => setChoices((all) => ({ ...all, [conflict.nodeId]: choice }))}
                    />
                  ))}
                </section>
              ) : null}

              {!nothing ? (
                <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-(--pn-line) bg-(--pn-bg) px-1 py-4">
                  {applyError ? <InlineAlert className="basis-full">{applyError}</InlineAlert> : null}
                  {plan.conflicts.length ? (
                    <p className="text-[13px] text-(--pn-fg-muted) tabular-nums" aria-live="polite">
                      {resolved} di {plan.conflicts.length} conflitti risolti
                    </p>
                  ) : null}
                  <LoadingButton
                    icon={GitMerge}
                    pending={applying}
                    disabled={!ready || !draft.can.merge}
                    onClick={() => void merge()}
                    className="h-10 px-4"
                  >
                    Unisci
                  </LoadingButton>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PageContent>
    </>
  )
}
