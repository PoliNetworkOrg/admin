import type { ReactNode, Ref } from "react"

import { SectionCard, Spinner } from "@/components/primitives"
import { cn } from "@/lib/utils"

import type { SigningDevice } from "./signing-device"

/**
 * Before hydration the device is unknown, so both variants render and CSS picks one: signing controls are hidden on
 * touch-only screens, the phone note everywhere else.
 */
export const computerOnly = "[@media(hover:none)_and_(pointer:coarse)]:hidden"
const phoneOnly = "hidden [@media(hover:none)_and_(pointer:coarse)]:block"

type EsignActionCardProps = {
  title: string
  /** Beside the title, e.g. an icon button that opens the request. */
  titleAction?: ReactNode
  badge?: ReactNode
  /** After the badge, e.g. "Segretario · p. 1". */
  meta?: string | null
  /** The one sentence about where things stand. */
  body?: ReactNode
  /** Under the sentence, inside the same live region: delivery lines, an alert, a button. */
  children?: ReactNode
  /** The body is where focus goes after an action changes it. */
  bodyId: string
  bodyRef?: Ref<HTMLDivElement>
  /** Replaces the signing controls on phones and tablets. */
  note?: string | null
  /** One muted line under the body. */
  muted?: ReactNode
  /** Why the primary is disabled; `lockId` is for its `aria-describedby`. */
  lock?: string | null
  lockId?: string
  /** One full-width button. */
  primary?: ReactNode
  /** The primary signs or leads to signing, so phones don't get it. */
  primarySigns?: boolean
  /** Under the primary, e.g. how many more documents wait; it goes with a signing primary on phones. */
  after?: ReactNode
  /** Footer row, left: one quiet button that leads to signing. */
  footerStart?: ReactNode
  /** Footer row, right: the card's one red button. */
  footerEnd?: ReactNode
  device: SigningDevice
}

/**
 * The top of the right column on the request and batch pages: the title, a status line, the one sentence that says
 * where things stand, and the one thing to do next. Presentational: the page decides what goes in each slot.
 */
export function EsignActionCard({
  title,
  titleAction,
  badge,
  meta,
  body,
  children,
  bodyId,
  bodyRef,
  note,
  muted,
  lock,
  lockId,
  primary,
  primarySigns = false,
  after,
  footerStart,
  footerEnd,
  device,
}: EsignActionCardProps) {
  // On a phone the page passes no signing controls; while unknown it passes both, and CSS shows one.
  const signing = device === "unknown" ? computerOnly : undefined
  const footer = (footerStart || footerEnd) && (
    <div className="flex items-center gap-2">
      {footerStart && <div className={signing}>{footerStart}</div>}
      {footerEnd && <div className="ml-auto">{footerEnd}</div>}
    </div>
  )
  return (
    <SectionCard footer={footer}>
      <div className="flex items-start gap-2">
        <h1 className="min-w-0 flex-1 text-[22px] leading-7 font-semibold tracking-[-0.01em] text-balance break-words">
          {title}
        </h1>
        {titleAction}
      </div>
      {(badge || meta) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] leading-5 text-(--pn-fg-muted) tabular-nums">
          {badge}
          {meta && <span className="min-w-0">{meta}</span>}
        </div>
      )}
      <div
        ref={bodyRef}
        id={bodyId}
        tabIndex={-1}
        aria-live="polite"
        className="mt-3 text-[14px] leading-5 text-pretty break-words text-(--pn-fg) empty:hidden"
      >
        {body && <p className={note ? signing : undefined}>{body}</p>}
        {note && (
          <p role="note" className={signing && phoneOnly}>
            {note}
          </p>
        )}
        {children}
      </div>
      {muted && <p className={cn("mt-1 text-[13px] leading-5 text-(--pn-fg-muted)", signing)}>{muted}</p>}
      {/* In the muted line's place and with its spacing, so the card's height holds as the lock comes and goes. */}
      {lock && (
        <p id={lockId} className={cn("mt-1 flex items-start gap-2 text-[13px] leading-5", signing)}>
          <Spinner className="mt-[3px] size-3.5 shrink-0 text-(--pn-fg-muted)" />
          {lock}
        </p>
      )}
      {primary && <div className={cn("mt-3", primarySigns && signing)}>{primary}</div>}
      {after && (
        <div className={cn("mt-2 text-[13px] leading-5 text-(--pn-fg-muted)", primarySigns && signing)}>{after}</div>
      )}
    </SectionCard>
  )
}
