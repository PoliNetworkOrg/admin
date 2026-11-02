import { StatusBadge, type StatusTone } from "@/components/primitives"
import { cn } from "@/lib/utils"

import type { ArticleChange } from "./regulations.contract"

const KINDS = {
  added: { label: "Nuovo", tone: "success" },
  removed: { label: "Abrogato", tone: "danger" },
  modified: { label: "Modificato", tone: "warning" },
  moved: { label: "Spostato", tone: "brand" },
  renumbered: { label: "Rinumerato", tone: "neutral" },
} satisfies Record<ArticleChange["kind"], { label: string; tone: StatusTone }>

/** Inserted words: underlined on the success tint; deleted words: struck through on the danger tint. */
const insertMark =
  "rounded-[3px] bg-(--pn-success-bg) text-(--pn-fg) underline decoration-(--pn-success-fg) decoration-2"
const deleteMark = "rounded-[3px] bg-(--pn-danger-bg) text-(--pn-fg) line-through decoration-(--pn-danger-fg)"

function Side({ heading, label, children }: { heading: string; label: string | null; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 p-4">
      <p className="text-xs text-(--pn-fg-muted)">
        {heading}
        {label ? <span className="text-(--pn-fg)"> · {label}</span> : null}
      </p>
      <div className="text-[14px] leading-6 whitespace-pre-wrap text-(--pn-fg) [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  )
}

/**
 * One changed article, old and new side by side (stacked on narrow screens), with the words that changed marked on
 * each side. Added and removed articles show their one side whole.
 */
export function DiffArticle({ article }: { article: ArticleChange }) {
  const kind = KINDS[article.kind]
  const title = article.newLabel ?? article.oldLabel ?? article.id
  const words = article.words.length
    ? article.words
    : [{ op: "equal" as const, text: article.newText ?? article.oldText ?? "" }]
  const before = words.filter((part) => part.op !== "insert")
  const after = words.filter((part) => part.op !== "delete")

  return (
    <article
      id={`articolo-${article.id}`}
      className="scroll-mt-6 overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)"
    >
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-(--pn-line) px-4 py-3">
        <h3 className="text-[15px] font-semibold text-(--pn-fg)">{title}</h3>
        <StatusBadge tone={kind.tone}>{kind.label}</StatusBadge>
        {article.moved ? (
          <span className="basis-full text-[13px] text-(--pn-fg-muted)">
            Spostato da {article.moved.from} a {article.moved.to}
          </span>
        ) : null}
        {article.kind === "renumbered" && article.oldLabel && article.oldLabel !== article.newLabel ? (
          <span className="basis-full text-[13px] text-(--pn-fg-muted)">Prima: {article.oldLabel}</span>
        ) : null}
      </header>
      <div
        className={cn(
          "grid divide-(--pn-line)",
          article.kind === "added" || article.kind === "removed"
            ? "grid-cols-1"
            : "max-[760px]:divide-y min-[760px]:grid-cols-2 min-[760px]:divide-x"
        )}
      >
        {article.kind !== "added" ? (
          <Side
            heading="Prima"
            label={article.kind === "removed" ? null : article.oldLabel !== article.newLabel ? article.oldLabel : null}
          >
            {article.kind === "removed" ? (
              <del className={deleteMark}>{article.oldText}</del>
            ) : (
              before.map((part, index) =>
                part.op === "delete" ? (
                  <del key={index} className={deleteMark}>
                    {part.text}
                  </del>
                ) : (
                  <span key={index}>{part.text}</span>
                )
              )
            )}
          </Side>
        ) : null}
        {article.kind !== "removed" ? (
          <Side heading="Dopo" label={null}>
            {article.kind === "added" ? (
              <ins className={insertMark}>{article.newText}</ins>
            ) : (
              after.map((part, index) =>
                part.op === "insert" ? (
                  <ins key={index} className={insertMark}>
                    {part.text}
                  </ins>
                ) : (
                  <span key={index}>{part.text}</span>
                )
              )
            )}
          </Side>
        ) : null}
      </div>
    </article>
  )
}
