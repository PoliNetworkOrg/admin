import { Circle, CircleCheck, CircleMinus, CircleX, ExternalLink, RefreshCw, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"

import { inlineLink, LoadingButton, SectionCard, Spinner, StatusBadge } from "@/components/primitives"
import { cn } from "@/lib/utils"

import { formatDayTime } from "./regulations-format"
import type { Emanation } from "./regulations.contract"

type Step = Emanation["steps"][number]

export const STEP_LABELS = {
  pr: "Pull request sul repository legal",
  checks: "Controlli automatici (CI)",
  merge: "Merge automatico",
  tag: "Tag della versione",
  release: "Release con il PDF ufficiale",
  email: "Email ai Soci",
  telegram: "Messaggio nel gruppo Telegram dei Soci",
} satisfies Record<Step["key"], string>

const STATUS = {
  running: { tone: "brand", label: "In corso" },
  waiting: { tone: "brand", label: "In attesa di GitHub" },
  done: { tone: "success", label: "Completata" },
  failed: { tone: "danger", label: "Interrotta" },
} as const

const CHANNEL_LABELS = { email: "Email", telegram: "Telegram" } as const
const NOTIFICATION_STATUS = { pending: "In attesa", sent: "Inviata", failed: "Non inviata" } as const

function StepIcon({ state }: { state: Step["state"] }) {
  if (state === "running") return <Spinner className="size-4.5 text-(--pn-accent)" />
  const Icon = { pending: Circle, done: CircleCheck, failed: CircleX, skipped: CircleMinus }[state]
  return (
    <Icon
      aria-hidden
      strokeWidth={1.75}
      className={cn(
        "size-4.5",
        state === "done" && "text-(--pn-success-fg)",
        state === "failed" && "text-(--pn-danger-fg)",
        (state === "pending" || state === "skipped") && "text-(--pn-fg-subtle)"
      )}
    />
  )
}

const STEP_STATE_TEXT = {
  pending: "da fare",
  running: "in corso",
  done: "fatto",
  failed: "non riuscito",
  skipped: "saltato",
} satisfies Record<Step["state"], string>

/**
 * "Emana e notifica" as it happens: the PR with the generated sources, CI, the automatic merge, tag and release, then
 * the email and the Telegram message. Every step links to where it happened; a failed one can be resumed.
 */
export function EmanationCard({
  emanation,
  onRetry,
  retrying,
}: {
  emanation: Emanation
  onRetry: (() => void) | null
  retrying: boolean
}) {
  const status = STATUS[emanation.status]
  const stalled = useStalledStep(emanation)
  return (
    <SectionCard
      title="Emanazione"
      action={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      footer={
        emanation.status === "failed" && onRetry ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-(--pn-fg-muted)">
              Riprende dal passaggio non riuscito: quelli fatti restano.
            </p>
            <LoadingButton size="sm" icon={RotateCcw} pending={retrying} onClick={onRetry}>
              Riprova
            </LoadingButton>
          </div>
        ) : stalled && onRetry ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-(--pn-fg-muted)">
              Il passaggio è fermo da un po': GitHub può metterci qualche minuto.
            </p>
            <LoadingButton size="sm" variant="outline" icon={RefreshCw} pending={retrying} onClick={onRetry}>
              Controlla ora
            </LoadingButton>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-(--pn-fg-muted)">
          Avviata da {emanation.startedBy.name} il {formatDayTime(emanation.startedAt)}
          {emanation.tag ? (
            <>
              {" · "}
              <span className="font-mono">{emanation.tag}</span>
            </>
          ) : null}
          {emanation.finishedAt ? ` · conclusa il ${formatDayTime(emanation.finishedAt)}` : ""}
        </p>
        <ol aria-live="polite" className="flex flex-col">
          {emanation.steps.map((step, index) => (
            <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
              {index < emanation.steps.length - 1 ? (
                <span aria-hidden className="absolute top-6 bottom-0 left-[8.5px] w-px bg-(--pn-line)" />
              ) : null}
              <span className="relative mt-px grid size-4.5 shrink-0 place-items-center bg-(--pn-surface)">
                <StepIcon state={step.state} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p
                  className={cn(
                    "text-[14px] leading-5",
                    step.state === "pending" || step.state === "skipped" ? "text-(--pn-fg-muted)" : "text-(--pn-fg)"
                  )}
                >
                  {STEP_LABELS[step.key]}
                  <span className="sr-only">: {STEP_STATE_TEXT[step.state]}</span>
                </p>
                {step.detail || step.at || step.url ? (
                  <p
                    className={cn(
                      "flex flex-wrap gap-x-2 text-xs",
                      step.state === "failed" ? "text-(--pn-danger-fg)" : "text-(--pn-fg-muted)"
                    )}
                  >
                    {step.detail ? <span>{step.detail}</span> : null}
                    {step.at ? <span className="tabular-nums">{formatDayTime(step.at)}</span> : null}
                    {step.url ? (
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(inlineLink, "inline-flex items-center gap-1")}
                      >
                        Apri
                        <ExternalLink aria-hidden className="size-3" />
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {emanation.notifications.length ? (
          <div className="flex flex-col gap-2 border-t border-(--pn-line) pt-3">
            <h3 className="text-[13px] font-medium text-(--pn-fg)">Notifiche inviate</h3>
            <ul className="flex flex-col gap-1.5">
              {emanation.notifications.map((notification, index) => (
                <li
                  key={`${notification.channel}-${index}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
                >
                  <span className="font-medium text-(--pn-fg)">{CHANNEL_LABELS[notification.channel]}</span>
                  <span className="text-(--pn-fg-muted)">a {notification.recipients.join(", ")}</span>
                  <StatusBadge
                    tone={
                      notification.status === "sent"
                        ? "success"
                        : notification.status === "failed"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {NOTIFICATION_STATUS[notification.status]}
                  </StatusBadge>
                  {notification.sentAt ? (
                    <span className="text-xs text-(--pn-fg-muted) tabular-nums">
                      {formatDayTime(notification.sentAt)}
                    </span>
                  ) : null}
                  {notification.error ? (
                    <span className="basis-full text-xs text-(--pn-danger-fg)">{notification.error}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}

/** How long a step may run before the card offers to check GitHub again (the backend polls every 30 s anyway). */
const STALL_MS = 20_000

/** Whether the running step has been running, as seen from this page, for longer than `STALL_MS`. */
function useStalledStep(emanation: Emanation) {
  const running = emanation.status === "running" || emanation.status === "waiting"
  const step = running ? (emanation.steps.find((candidate) => candidate.state === "running")?.key ?? null) : null
  const [since, setSince] = useState<{ step: string | null; at: number }>({ step, at: Date.now() })
  const [now, setNow] = useState(() => Date.now())
  if (since.step !== step) setSince({ step, at: Date.now() })
  useEffect(() => {
    if (!step) return
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [step])
  return step !== null && since.step === step && now - since.at > STALL_MS
}
