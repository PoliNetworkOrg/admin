import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Link } from "@tanstack/react-router"
import { X } from "lucide-react"
import { type ReactNode, useState } from "react"

import {
  dialogMotion,
  dialogPanel,
  IconButton,
  KeyValueList,
  scrimClasses,
  SectionEmpty,
  Spinner,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { dialogDescriptionText, dialogTitleText } from "@/components/primitives/confirm-dialog"
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import {
  actionLabel,
  actorName,
  actorVia,
  areaLabel,
  OUTCOME,
  targetName,
  targetTypeLabel,
} from "@/features/audit-log/audit-labels"
import type { AuditEvent, AuditJson } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type JsonObject = Exclude<NonNullable<AuditJson>, string | number | boolean | AuditJson[]>

function isObject(value: AuditJson): value is JsonObject {
  return value instanceof Object && !Array.isArray(value)
}

type Change = { field: string; before: AuditJson | undefined; after: AuditJson | undefined }

/**
 * The fields that differ between the two states, or every field of a record that was only created or only removed.
 * Null when the states are not records (a list of rows, a value), which are shown whole instead.
 */
function fieldChanges(before: AuditJson, after: AuditJson): Change[] | null {
  if ((before !== null && !isObject(before)) || (after !== null && !isObject(after))) return null
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
  return fields
    .map((field) => ({ field, before: before?.[field], after: after?.[field] }))
    .filter(
      (change) => before === null || after === null || JSON.stringify(change.before) !== JSON.stringify(change.after)
    )
}

function JsonValue({ value }: { value: AuditJson | undefined }) {
  if (value === undefined || value === null) return <Unset />
  if (isObject(value) || Array.isArray(value))
    return (
      <pre className="max-h-64 overflow-auto font-mono text-xs leading-5 whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(value)}</span>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[15px] leading-6 font-semibold">{title}</h3>
      {children}
    </section>
  )
}

const changeGrid = "grid grid-cols-[minmax(88px,140px)_1fr_1fr] gap-x-4 max-shell:grid-cols-1"

function Changes({ event }: { event: AuditEvent }) {
  if (event.before === null && event.after === null)
    return <SectionEmpty title="No changes recorded" hint="The action did not report the state it changed." />

  const changes = fieldChanges(event.before, event.after)
  if (changes === null)
    return (
      <div className="grid grid-cols-2 gap-3 max-shell:grid-cols-1">
        <ChangeSide label="Before" value={event.before} />
        <ChangeSide label="After" value={event.after} />
      </div>
    )
  if (changes.length === 0) return <SectionEmpty title="Nothing changed" hint="Before and after are the same." />

  return (
    <div className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line)">
      <div
        className={cn(
          changeGrid,
          "bg-(--pn-muted) px-3 py-2 text-xs font-medium text-(--pn-fg-muted) max-shell:hidden"
        )}
      >
        <span>Field</span>
        <span>Before</span>
        <span>After</span>
      </div>
      {changes.map((change) => (
        <div
          key={change.field}
          className={cn(changeGrid, "border-t border-(--pn-line) px-3 py-2.5 text-[13px] leading-5 first:border-t-0")}
        >
          <span className="font-mono text-xs leading-5 text-(--pn-fg-muted)">{change.field}</span>
          <span className="min-w-0">
            <span className="hidden text-xs text-(--pn-fg-muted) max-shell:inline">Before: </span>
            <JsonValue value={change.before} />
          </span>
          <span className="min-w-0">
            <span className="hidden text-xs text-(--pn-fg-muted) max-shell:inline">After: </span>
            <JsonValue value={change.after} />
          </span>
        </div>
      ))}
    </div>
  )
}

function ChangeSide({ label, value }: { label: string; value: AuditJson }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-(--pn-fg-muted)">{label}</span>
      <div className="rounded-(--pn-r-4) border border-(--pn-line) p-3 text-[13px]">
        <JsonValue value={value} />
      </div>
    </div>
  )
}

function Target({ event }: { event: AuditEvent }) {
  const name = targetName(event)
  if (name === null || event.targetType === null) return null
  // Without a label the name already is the type and ID.
  const hint = event.targetLabel
    ? `${targetTypeLabel(event.targetType)}${event.targetId ? ` · ${event.targetId}` : ""}`
    : null
  return (
    <span className="flex flex-col">
      {event.targetType === "tg.user" && event.targetId ? (
        <Link
          to="/dashboard/telegram/users/$userId"
          params={{ userId: event.targetId }}
          className="text-(--pn-accent) underline-offset-2 hover:underline"
        >
          {name}
        </Link>
      ) : (
        name
      )}
      {hint && <span className="text-xs text-(--pn-fg-muted)">{hint}</span>}
    </span>
  )
}

type AuditEventDialogProps = {
  /** The event, or `"loading"` while one opened from a link is fetched. */
  event: AuditEvent | "loading" | null
  onClose: () => void
}

/** One event: who did what to what and when, the outcome, the fields that changed and the request as sent. */
export function AuditEventDialog({ event, onClose }: AuditEventDialogProps) {
  // The last event shown stays while the dialog animates out.
  const [shown, setShown] = useState<AuditEvent | null>(null)
  if (event !== null && event !== "loading" && event !== shown) setShown(event)
  const loaded = event === "loading" ? null : (event ?? shown)
  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className={scrimClasses} />
        <DialogPrimitive.Popup className={cn(dialogPanel, dialogMotion, "max-w-[720px]")}>
          <header className="relative flex shrink-0 flex-col gap-1.5 px-5 pt-5 pr-14">
            <DialogTitle className={dialogTitleText}>{loaded ? actionLabel(loaded.action) : "Event"}</DialogTitle>
            <DialogDescription className={dialogDescriptionText}>
              {loaded ? `${areaLabel(loaded.action)} · ${formatDateTime(loaded.createdAt)}` : "Loading the event…"}
            </DialogDescription>
            <IconButton label="Close" icon={X} onClick={onClose} className="absolute top-3 right-3" />
          </header>

          {loaded ? (
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
              <KeyValueList
                items={[
                  { key: "By", value: actorName(loaded), hint: actorVia(loaded) },
                  { key: "Target", value: <Target event={loaded} /> },
                  {
                    key: "Outcome",
                    value: (
                      <StatusBadge tone={OUTCOME[loaded.outcome].tone}>{OUTCOME[loaded.outcome].label}</StatusBadge>
                    ),
                    hint: loaded.error,
                  },
                  { key: "Reason", value: loaded.reason },
                  { key: "Action", value: loaded.action, mono: true },
                ]}
              />
              <Section title="Changes">
                <Changes event={loaded} />
              </Section>
              <Section title="Request">
                <div className="rounded-(--pn-r-4) border border-(--pn-line) p-3 text-[13px]">
                  <JsonValue value={loaded.input} />
                </div>
              </Section>
            </div>
          ) : (
            <div className="flex justify-center p-10">
              <Spinner />
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
