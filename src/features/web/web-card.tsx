import { Chip } from "@/components/primitives"
import { cn } from "@/lib/utils"

/** 18px "IT"/"EN" chip in front of a description (§5.2). */
export function LanguageChip({ code, className }: { code: string; className?: string }) {
  return (
    <Chip size="tiny" aria-hidden className={cn("justify-self-start", className)}>
      {code}
    </Chip>
  )
}

export function LanguageTerm({ code, name }: { code: string; name: string }) {
  return (
    <dt className="mt-px">
      <LanguageChip code={code} />
      <span className="sr-only">{name}</span>
    </dt>
  )
}

/** Focuses the first field when an inline edit opens, on fine pointers only (§5.4 autofocus rule). */
export function focusOnFinePointer(element: HTMLElement | null) {
  if (element && window.matchMedia("(pointer: fine)").matches) element.focus()
}
