import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Check, FileDiff, GitMerge, Landmark, PenLine, Send, Undo2, Users } from "lucide-react"
import { cloneElement, type ReactElement, type ReactNode, useEffect, useState } from "react"

import {
  buttonMotion,
  Chip,
  ConfirmDialog,
  Hint,
  initialsOf,
  InlineAlert,
  inlineLink,
  KeyValueList,
  RecordHeader,
  SectionCard,
  SectionEmpty,
} from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ApproveDialog } from "./approve-dialog"
import { DraftActions } from "./draft-actions"
import { MembersDialog } from "./members-dialog"
import { EmanationCard } from "./procedure-emanation"
import { emanateRectification, retryEmanation } from "./regulations-draft.functions"
import {
  BODY_LABELS,
  baseLabel,
  deliberaLine,
  formatDay,
  formatDayTime,
  KIND_LABELS,
  ROLE_LABELS,
} from "./regulations-format"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { emanateDraft } from "./regulations-manage.functions"
import { DraftKindMark, DraftStateBadge } from "./regulations-ui"
import { transitionDraft } from "./regulations-write.functions"
import type { Assignment, Draft, Emanation, StateKey } from "./regulations.contract"
import { getEmanation } from "./regulations.functions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const
const POLL_MS = 2000

type Transition = Draft["can"]["transitions"][number]

/** What each plain transition does, said in its confirmation. */
const TRANSITION_TEXT = {
  in_approvazione: {
    title: "Inviare in approvazione?",
    description:
      "Il testo si blocca: nessuno lo modifica finché non torna in bozza. Si genera il documento delle differenze, e nessun'altra bozza di questo documento può andare in approvazione.",
    done: "Bozza inviata in approvazione.",
  },
  bozza: {
    title: "Riportare in bozza?",
    description: "Il testo torna modificabile dai membri. Il documento delle differenze generato si scarta.",
    done: "Riportata in bozza: il testo si può di nuovo modificare.",
  },
} satisfies Partial<Record<StateKey, { title: string; description: string; done: string }>>

function transitionText(to: StateKey) {
  return to === "bozza" || to === "in_approvazione" ? TRANSITION_TEXT[to] : null
}

/** The states this kind of draft goes through, in order: a rettifica skips the approval. */
function pathOf(draft: Draft) {
  const used = new Set<StateKey>()
  for (const transition of draft.procedure.transitions)
    if (transition.kinds.includes(draft.kind)) {
      used.add(transition.from)
      used.add(transition.to)
    }
  return draft.procedure.states.filter((state) => used.has(state.key))
}

function Stepper({ draft }: { draft: Draft }) {
  const states = pathOf(draft)
  const current = states.findIndex((state) => state.key === draft.state)
  const when = (key: StateKey) => (key === "approvata" ? draft.approvedAt : key === "emanata" ? draft.emanatedAt : null)
  return (
    <ol className="grid gap-3 min-[560px]:grid-flow-col min-[560px]:auto-cols-fr">
      {states.map((state, index) => {
        const done = index < current
        const active = index === current
        const at = active ? draft.stateChangedAt : when(state.key)
        return (
          <li
            key={state.key}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-(--pn-r-4) border px-3 py-2.5 min-[560px]:flex-col min-[560px]:items-start min-[560px]:gap-1",
              active ? "border-(--pn-accent) bg-(--pn-accent-soft)" : "border-(--pn-line)"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs",
                done && "border-(--pn-success-fg) text-(--pn-success-fg)",
                active && "border-(--pn-accent) bg-(--pn-accent-solid) text-(--pn-accent-solid-fg)",
                !done && !active && "border-(--pn-line-strong) text-(--pn-fg-muted)"
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn("text-[14px] font-medium", active || done ? "text-(--pn-fg)" : "text-(--pn-fg-muted)")}
              >
                {state.label}
              </span>
              <span className="text-xs text-(--pn-fg-muted) tabular-nums">
                {at && (done || active) ? formatDay(at) : active ? "Ora" : done ? "Fatto" : " "}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function MemberRow({ member }: { member: Assignment }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-muted) text-xs font-semibold text-(--pn-fg-muted)"
        >
          {initialsOf(member.user.name)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] text-(--pn-fg)">{member.user.name}</span>
          {member.user.email ? (
            <span className="truncate font-mono text-xs text-(--pn-fg-muted)">{member.user.email}</span>
          ) : null}
        </span>
      </span>
      <Chip>{ROLE_LABELS[member.role]}</Chip>
    </li>
  )
}

/**
 * A draft's way to publication: the procedure's states with the current one marked, the actions the viewer may take
 * now (each refused one says why), the delibera, the deadlines, and "Emana e notifica" step by step. Votes,
 * oppositions and discussion happen outside the dashboard; this page records their outcome.
 */
export function ProcedurePage({
  draft,
  members,
  emanation: loadedEmanation,
}: {
  draft: Draft
  members: Assignment[]
  emanation: Emanation | null
}) {
  const router = useRouter()
  const refresh = useRefreshAfter()
  const transition = useServerFn(transitionDraft)
  const emanate = useServerFn(emanateDraft)
  const emanateRettifica = useServerFn(emanateRectification)
  const retry = useServerFn(retryEmanation)
  const fetchEmanation = useServerFn(getEmanation)

  const [pendingTransition, setPendingTransition] = useState<Transition | null>(null)
  const [transitionOpen, setTransitionOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [emanateOpen, setEmanateOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [emanation, setEmanation] = useState(loadedEmanation)
  const [retrying, setRetrying] = useState(false)
  const [watching, setWatching] = useState(false)

  useEffect(() => setEmanation(loadedEmanation), [loadedEmanation])

  const live =
    watching ||
    emanation?.status === "running" ||
    emanation?.status === "waiting" ||
    draft.emanationStatus === "running"
  // While an emanation runs, its steps come in every couple of seconds; once it ends, the draft reloads (emanata).
  useEffect(() => {
    if (!live) return
    let current = true
    const timer = setInterval(() => {
      fetchEmanation({ data: { draftId: draft.id } }).then(
        (next) => {
          if (!current) return
          setEmanation(next)
          if (next && (next.status === "done" || next.status === "failed")) {
            setWatching(false)
            router.invalidate().catch((error) => console.error(error))
            if (next.status === "done") appToast.success("Emanata e notificata.")
          }
        },
        (error) => console.error(error)
      )
    }, POLL_MS)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [live, draft.id, fetchEmanation, router])

  const stateLabel = draft.procedure.states.find((state) => state.key === draft.state)?.label
  const plain = draft.can.transitions.filter((option) => !option.requires.includes("delibera"))
  const approval = draft.can.transitions.find((option) => option.requires.includes("delibera"))
  const rettifica = draft.kind === "rettifica"
  const releaseUrl = emanation?.steps.find((step) => step.key === "release")?.url ?? null

  async function runTransition() {
    if (!pendingTransition) return
    const to = pendingTransition.to
    if (to !== "bozza" && to !== "in_approvazione") return
    try {
      await transition({ data: { draftId: draft.id, to } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile cambiare lo stato. Riprova."), { cause: caught })
    }
    await refresh(TRANSITION_TEXT[to].done)
  }

  async function runEmanation() {
    try {
      await (rettifica ? emanateRettifica : emanate)({ data: { draftId: draft.id } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, "Non è stato possibile avviare l'emanazione. Riprova."), { cause: caught })
    }
    setWatching(true)
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
    }
  }

  async function runRetry() {
    setRetrying(true)
    try {
      await retry({ data: { draftId: draft.id } })
      setWatching(true)
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.error(failureMessage(caught, "Non è stato possibile riprendere l'emanazione. Riprova."))
    } finally {
      setRetrying(false)
    }
  }

  const deliberaItems =
    draft.delibera?.kind === "approvazione"
      ? [
          { key: "Organo", value: BODY_LABELS[draft.delibera.body] },
          { key: "Votazione", value: formatDay(draft.delibera.date) },
          {
            key: "Verbale",
            value: draft.delibera.verbaleUrl ? (
              <a href={draft.delibera.verbaleUrl} target="_blank" rel="noreferrer" className={inlineLink}>
                Apri il verbale
              </a>
            ) : null,
          },
          {
            key: "Registrata",
            value: `${draft.delibera.recordedBy.name}, ${formatDayTime(draft.delibera.recordedAt)}`,
          },
        ]
      : draft.delibera?.kind === "rettifica"
        ? [
            { key: "Rettifica", value: formatDay(draft.delibera.date) },
            { key: "Da", value: draft.delibera.rectifiedBy.name },
            ...(draft.delibera.onBehalfOf
              ? [{ key: "Su delega di", value: `${draft.delibera.onBehalfOf.name} (Segretario)` }]
              : []),
          ]
        : []

  return (
    <>
      <PageBar
        width="record"
        back={BACK}
        crumb="Bozze"
        context={draft.title}
        right={
          <>
            <Button
              variant="outline"
              className={buttonMotion}
              nativeButton={false}
              render={<Link to="/dashboard/regulations/drafts/$draftId" params={{ draftId: draft.id }} />}
            >
              <PenLine data-icon="inline-start" />
              Apri editor
            </Button>
            <DraftActions draft={draft} />
          </>
        }
      />
      <PageContent width="record">
        <div className="flex flex-col gap-6">
          <RecordHeader
            title={draft.title}
            badge={
              <>
                <DraftStateBadge state={draft.state} label={stateLabel} />
                <DraftKindMark kind={draft.kind} />
              </>
            }
            meta={`${KIND_LABELS[draft.kind]} da ${baseLabel(draft.base)} · creata da ${draft.createdBy.name} il ${formatDay(draft.createdAt)}`}
          />

          {draft.deadlines.length || draft.parses === false ? (
            <div className="flex flex-col gap-2">
              {draft.parses === false && draft.state === "bozza" ? (
                <InlineAlert tone="warning">
                  Il testo ha errori di struttura: si può continuare a scrivere, ma non inviarlo in approvazione né
                  unirlo finché non sono corretti. Li trovi nell'editor.
                </InlineAlert>
              ) : null}
              {draft.deadlines.map((deadline) =>
                deadline.severity === "warning" ? (
                  draft.notifiedAt ? null : (
                    <InlineAlert key={deadline.key} tone={deadline.overdue ? "danger" : "warning"}>
                      {deadline.overdue
                        ? `${deadline.label}: il termine è scaduto il ${formatDayTime(deadline.dueAt)}. Va emanata e notificata al più presto.`
                        : `${deadline.label}: da emanare e notificare entro il ${formatDayTime(deadline.dueAt)}.`}
                    </InlineAlert>
                  )
                ) : (
                  <InlineAlert key={deadline.key} tone="info">
                    {deadline.label}: i Soci possono opporsi o ricorrere al Collegio dei Probiviri fino al{" "}
                    {formatDayTime(deadline.dueAt)}. Solo informativo: l'esito si gestisce fuori dalla dashboard.
                  </InlineAlert>
                )
              )}
            </div>
          ) : null}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard title="Procedura">
                <div className="flex flex-col gap-4">
                  <Stepper draft={draft} />
                  {plain.length || approval || draft.can.emanate ? (
                    <div className="flex flex-col gap-3 border-t border-(--pn-line) pt-4">
                      <div className="flex flex-wrap gap-2">
                        {draft.can.emanate ? (
                          <Button className={buttonMotion} onClick={() => setEmanateOpen(true)}>
                            <Landmark data-icon="inline-start" />
                            {rettifica ? "Emana rettifica" : "Emana e notifica"}
                          </Button>
                        ) : null}
                        {approval ? (
                          <TransitionButton
                            option={approval}
                            primary={!draft.can.emanate}
                            onClick={() => setApproveOpen(true)}
                          />
                        ) : null}
                        {plain.map((option) => (
                          <TransitionButton
                            key={option.to}
                            option={option}
                            primary={!approval && !draft.can.emanate && option.to !== "bozza"}
                            onClick={() => {
                              setPendingTransition(option)
                              setTransitionOpen(true)
                            }}
                          />
                        ))}
                      </div>
                      {[approval, ...plain].map((option) =>
                        option?.blockedBy ? (
                          <p key={option.to} className="text-[13px] text-(--pn-fg-muted)">
                            <span className="font-medium text-(--pn-fg)">{option.label}:</span> {option.blockedBy}
                          </p>
                        ) : null
                      )}
                    </div>
                  ) : (
                    <p className="border-t border-(--pn-line) pt-4 text-[13px] text-(--pn-fg-muted)">
                      {draft.state === "emanata"
                        ? "Procedura conclusa."
                        : "Nessun passaggio disponibile per te in questo momento."}
                    </p>
                  )}
                </div>
              </SectionCard>

              {emanation ? (
                <EmanationCard
                  emanation={emanation}
                  retrying={retrying}
                  onRetry={draft.can.emanate || draft.can.rectify || draft.can.approve ? () => void runRetry() : null}
                />
              ) : null}

              {draft.delibera ? (
                <SectionCard title={draft.delibera.kind === "rettifica" ? "Rettifica" : "Delibera"}>
                  <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-medium text-(--pn-fg)">{deliberaLine(draft.delibera)}</p>
                    <KeyValueList items={deliberaItems} />
                  </div>
                </SectionCard>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard
                title="Membri"
                count={members.length}
                padding="flush"
                action={
                  draft.can.assign ? (
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setMembersOpen(true)}>
                      <Users data-icon="inline-start" />
                      Gestisci membri
                    </Button>
                  ) : undefined
                }
              >
                {members.length ? (
                  <ul className="flex flex-col divide-y divide-(--pn-line)">
                    {members.map((member) => (
                      <MemberRow key={member.user.id} member={member} />
                    ))}
                  </ul>
                ) : (
                  <SectionEmpty
                    title="Nessun membro"
                    hint="La vede chi ha accesso ai Regolamenti. Aggiungi qualcuno per farlo lavorare su questa bozza."
                  />
                )}
              </SectionCard>

              <SectionCard title="Collegamenti" padding="flush">
                <ul className="flex flex-col divide-y divide-(--pn-line)">
                  <LinkRow icon={PenLine} label="Editor" detail="Testo, commenti e cronologia">
                    <Link to="/dashboard/regulations/drafts/$draftId" params={{ draftId: draft.id }} />
                  </LinkRow>
                  {draft.diffStatus !== "none" ? (
                    <LinkRow
                      icon={FileDiff}
                      label="Differenze"
                      detail={
                        draft.diffStatus === "pending" ? "In preparazione" : "Riepilogo e confronto degli articoli"
                      }
                    >
                      <Link to="/dashboard/regulations/drafts/$draftId/diff" params={{ draftId: draft.id }} />
                    </LinkRow>
                  ) : null}
                  {draft.can.merge ? (
                    <LinkRow icon={GitMerge} label="Unisci un'altra bozza" detail="O una versione pubblicata">
                      <Link to="/dashboard/regulations/drafts/$draftId/merge" params={{ draftId: draft.id }} />
                    </LinkRow>
                  ) : null}
                  {releaseUrl && draft.state === "emanata" ? (
                    <LinkRow icon={Send} label="Versione pubblicata" detail="Release con il PDF ufficiale">
                      <a href={releaseUrl} target="_blank" rel="noreferrer" />
                    </LinkRow>
                  ) : null}
                </ul>
              </SectionCard>
            </div>
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={transitionOpen}
        onOpenChange={setTransitionOpen}
        title={pendingTransition ? (transitionText(pendingTransition.to)?.title ?? `${pendingTransition.label}?`) : ""}
        description={pendingTransition ? (transitionText(pendingTransition.to)?.description ?? "") : ""}
        confirmLabel={pendingTransition?.label ?? ""}
        cancelLabel="Annulla"
        tone="primary"
        icon={pendingTransition?.to === "bozza" ? Undo2 : Send}
        onConfirm={runTransition}
      />
      <ConfirmDialog
        open={emanateOpen}
        onOpenChange={setEmanateOpen}
        title={rettifica ? "Emanare la rettifica?" : "Emanare e notificare?"}
        description={
          rettifica
            ? "Apre una pull request sul repository legal con i sorgenti corretti, che si unisce da sola appena la CI passa; poi tag e release con il PDF, email a soci@polinetwork.org e messaggio nel gruppo Telegram dei Soci. Il documento dirà chi l'ha rettificato. Non si annulla."
            : "Apre una pull request sul repository legal con i sorgenti generati, che si unisce da sola appena la CI passa; poi tag e release con il PDF ufficiale e quello delle differenze, email a soci@polinetwork.org e messaggio nel gruppo Telegram dei Soci. Da lì partono i dieci giorni per opposizioni e ricorsi. Non si annulla."
        }
        confirmLabel={rettifica ? "Emana rettifica" : "Emana e notifica"}
        cancelLabel="Annulla"
        tone="primary"
        icon={Landmark}
        onConfirm={runEmanation}
      />
      <ApproveDialog open={approveOpen} onOpenChange={setApproveOpen} draft={draft} />
      {draft.can.assign ? (
        <MembersDialog open={membersOpen} onOpenChange={setMembersOpen} draft={draft} members={members} />
      ) : null}
    </>
  )
}

/** A transition the viewer holds; while it's refused for now, disabled with the reason as its hint. */
function TransitionButton({ option, primary, onClick }: { option: Transition; primary: boolean; onClick: () => void }) {
  const button = (
    <Button
      variant={primary ? "default" : "outline"}
      className={buttonMotion}
      disabled={option.blockedBy !== null}
      onClick={onClick}
    >
      {option.to === "bozza" ? <Undo2 data-icon="inline-start" /> : <Send data-icon="inline-start" />}
      {option.label}
    </Button>
  )
  if (!option.blockedBy) return button
  return (
    <Hint label={option.blockedBy}>
      <span tabIndex={0} className="inline-flex rounded-(--pn-r-3)">
        {button}
      </span>
    </Hint>
  )
}

function LinkRow({
  icon: Icon,
  label,
  detail,
  children,
}: {
  icon: typeof PenLine
  label: string
  detail: string
  /** The link (a router `Link` or an `a`), drawn as the row. */
  children: ReactElement<{ className?: string; children?: ReactNode }>
}) {
  return (
    <li>
      {cloneElement(children, {
        className:
          "flex w-full items-center gap-3 px-4 py-3 transition-[background-color] duration-120 hover:bg-(--pn-hover)",
        children: (
          <>
            <Icon aria-hidden strokeWidth={1.75} className="size-4.5 shrink-0 text-(--pn-fg-muted)" />
            <span className="flex min-w-0 flex-col">
              <span className="text-[14px] font-medium text-(--pn-fg)">{label}</span>
              <span className="text-xs text-(--pn-fg-muted)">{detail}</span>
            </span>
          </>
        ),
      })}
    </li>
  )
}
