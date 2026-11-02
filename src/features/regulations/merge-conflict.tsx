import { ChevronRight } from "lucide-react"
import { useState } from "react"

import { fieldControl, Reveal, SegmentedControl } from "@/components/primitives"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import type { MergeConflict } from "./regulations.contract"

export type Choice = { kind: "ours" | "theirs" } | { kind: "custom"; text: string }

const TYPE_TEXT = {
  both_modified: "Modificato in entrambe",
  modified_deleted: "Modificato qui, eliminato nell'altra",
  deleted_modified: "Eliminato qui, modificato nell'altra",
  both_added: "Aggiunto in entrambe",
} satisfies Record<MergeConflict["type"], string>

function Source({ heading, text, emphasis }: { heading: string; text: string | null; emphasis?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 p-4", emphasis && "bg-(--pn-accent-soft)")}>
      <p className="text-xs font-medium text-(--pn-fg-muted)">{heading}</p>
      {text === null ? (
        <p className="text-[13px] text-(--pn-fg-muted)">Eliminato</p>
      ) : (
        <pre className="font-mono text-[13px] leading-5 whitespace-pre-wrap text-(--pn-fg) [overflow-wrap:anywhere]">
          {text}
        </pre>
      )}
    </div>
  )
}

/**
 * One structure node both drafts changed: this draft's text beside the source's, the common base on demand, and the
 * choice: keep this draft's, take the other's, or write the LaTeX by hand.
 */
export function ConflictCard({
  conflict,
  sourceName,
  choice,
  onChoice,
}: {
  conflict: MergeConflict
  sourceName: string
  choice: Choice | null
  onChoice: (choice: Choice) => void
}) {
  const [showBase, setShowBase] = useState(false)
  const id = `conflict-${conflict.nodeId}`
  const manual = choice?.kind === "custom"
  return (
    <article
      aria-labelledby={`${id}-title`}
      className={cn(
        "overflow-hidden rounded-(--pn-r-5) border bg-(--pn-surface)",
        choice ? "border-(--pn-line)" : "border-(--pn-warning-fg)"
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-(--pn-line) px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <h3 id={`${id}-title`} className="text-[15px] font-semibold text-(--pn-fg)">
            {conflict.label}
          </h3>
          <p className="text-xs text-(--pn-fg-muted)">
            {TYPE_TEXT[conflict.type]} · <span className="font-mono">{conflict.file}</span>
          </p>
        </div>
        <SegmentedControl
          label={`Scelta per ${conflict.label}`}
          value={choice?.kind ?? null}
          onValueChange={(kind) =>
            onChoice(kind === "custom" ? { kind, text: conflict.ours ?? conflict.theirs ?? "" } : { kind })
          }
          items={[
            { value: "ours", label: "Mantieni la mia" },
            { value: "theirs", label: "Usa l'altra" },
            { value: "custom", label: "Scrivi a mano" },
          ]}
        />
      </header>
      <div className="grid divide-(--pn-line) max-[760px]:divide-y min-[760px]:grid-cols-2 min-[760px]:divide-x">
        <Source heading="La tua bozza" text={conflict.ours} emphasis={choice?.kind === "ours"} />
        <Source heading={sourceName} text={conflict.theirs} emphasis={choice?.kind === "theirs"} />
      </div>
      {manual ? (
        <div className="flex flex-col gap-1.5 border-t border-(--pn-line) p-4">
          <label htmlFor={`${id}-text`} className="text-[13px] font-medium text-(--pn-fg)">
            Testo unito
          </label>
          <Textarea
            id={`${id}-text`}
            value={choice.text}
            onChange={(event) => onChoice({ kind: "custom", text: event.target.value })}
            spellCheck={false}
            className={cn(fieldControl, "min-h-32 font-mono text-[13px]")}
          />
          <p className="text-xs text-(--pn-fg-muted)">
            LaTeX del nodo, con il suo comando e il suo id: lascialo vuoto per eliminarlo.
          </p>
        </div>
      ) : null}
      <div className="border-t border-(--pn-line)">
        <button
          type="button"
          aria-expanded={showBase}
          aria-controls={`${id}-base`}
          onClick={() => setShowBase((open) => !open)}
          className="flex h-10 w-full items-center gap-1.5 px-4 text-[13px] text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-hover) hover:text-(--pn-fg)"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-4 transition-transform duration-200", showBase && "rotate-90")}
          />
          Testo di partenza
        </button>
        <Reveal open={showBase} lazy>
          <div id={`${id}-base`}>
            <Source heading="Base comune" text={conflict.base} />
          </div>
        </Reveal>
      </div>
    </article>
  )
}
