import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { floatingMotion, raisedSurface } from "./motion"

/** A form select over a list of labels, full width, styled like the inputs around it. */
export function SelectField<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder,
  invalid = false,
  describedBy,
}: {
  id: string
  value: T | null
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  placeholder?: string
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next)
        if (option) onChange(option.value)
      }}
      items={options}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="h-9 w-full border-(--pn-line-strong) bg-(--pn-surface) text-sm text-(--pn-fg) shadow-none aria-invalid:border-(--pn-danger-solid) pointer-coarse:text-base dark:bg-(--pn-surface)"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn(raisedSurface, floatingMotion)}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="h-9 text-[13px] focus:bg-(--pn-hover) focus:text-(--pn-fg) not-data-[variant=destructive]:focus:**:text-(--pn-fg)"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
