import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { type ReactNode, useId } from "react"

import { cn } from "@/lib/utils"

/**
 * A single choice drawn as cards (`RadioCard` children). Arrow keys move the choice; the label sits above the cards,
 * or stays for screen readers only with `hideLabel`.
 */
export function RadioCardGroup<T extends string>({
  label,
  hideLabel = false,
  value,
  onValueChange,
  invalid = false,
  describedBy,
  className,
  children,
}: {
  label: string
  hideLabel?: boolean
  value: T | null
  onValueChange: (value: T) => void
  invalid?: boolean
  describedBy?: string
  className?: string
  children: ReactNode
}) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className={hideLabel ? "sr-only" : "text-[13px] font-medium"}>
        {label}
      </span>
      <RadioGroup<T | null>
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next)
        }}
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn("flex flex-col gap-2", className)}
      >
        {children}
      </RadioGroup>
    </div>
  )
}

/** One choice in a `RadioCardGroup`: the radio, a bold label and a muted line explaining it; the whole card is clickable. */
export function RadioCard<T extends string>({
  value,
  label,
  description,
  lead,
  end,
}: {
  value: T
  label: ReactNode
  description?: ReactNode
  /** Between the radio and the text, such as an avatar. */
  lead?: ReactNode
  end?: ReactNode
}) {
  const id = useId()
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-(--pn-r-4) border border-(--pn-line-strong) p-3 transition-[background-color,border-color] duration-120 hover:border-(--pn-hover-line) hover:bg-(--pn-hover) has-data-checked:border-(--pn-accent) has-data-checked:bg-(--pn-accent-soft) has-data-checked:hover:bg-(--pn-accent-soft)">
      <Radio.Root
        value={value}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-surface) transition-[background-color,border-color] duration-120 data-checked:border-(--pn-accent-solid) data-checked:bg-(--pn-accent-solid)"
      >
        <Radio.Indicator className="size-1.5 rounded-full bg-(--pn-accent-solid-fg)" />
      </Radio.Root>
      {lead}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-[14px] font-medium">
          {label}
        </span>
        {description ? (
          <span id={`${id}-description`} className="text-xs text-(--pn-fg-muted)">
            {description}
          </span>
        ) : null}
      </span>
      {end}
    </label>
  )
}
