import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GROUP_LABEL_COLORS } from "@/features/group-labels/group-labels.constants"
import { cn } from "@/lib/utils"

import { Hint } from "./hint"
import { LabelDot } from "./label-chip"
import { buttonMotion, floatingMotion, raisedSurface } from "./motion"

const swatchButton =
  "flex size-9 items-center justify-center rounded-(--pn-r-2) transition-[background-color] duration-120 hover:bg-(--pn-muted) aria-pressed:bg-(--pn-accent-soft)"

function Swatch({ color, custom, className }: { color: string; custom: boolean; className?: string }) {
  if (custom) {
    return (
      <span
        aria-hidden
        className={cn("size-5 rounded-(--pn-r-1) border-2", className)}
        style={{ borderColor: color }}
      />
    )
  }
  return <LabelDot color={color} className={cn("size-5 rounded-(--pn-r-1)", className)} />
}

function isPaletteColor(value: string) {
  return GROUP_LABEL_COLORS.some((color) => color.hex.toLowerCase() === value.toLowerCase())
}

type ColorSwatchSelectProps = {
  value: string
  onChange: (hex: string) => void
  label?: string
  disabled?: boolean
  className?: string
}

/** 20px swatch trigger opening the 10-color palette; colors outside it show as "Custom". */
export function ColorSwatchSelect({
  value,
  onChange,
  label = "Label color",
  disabled,
  className,
}: ColorSwatchSelectProps) {
  const [open, setOpen] = useState(false)
  const custom = !isPaletteColor(value)

  function choose(hex: string) {
    onChange(hex)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label={label}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label={label}
              disabled={disabled}
              className={cn(
                buttonMotion,
                "gap-1.5 border-(--pn-line-strong) bg-(--pn-surface) px-2 shadow-none hover:bg-(--pn-muted)",
                className
              )}
            />
          }
        >
          <Swatch color={value} custom={custom} />
          <ChevronDown aria-hidden className="size-4 text-(--pn-fg-muted)" />
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        align="start"
        className={cn(raisedSurface, floatingMotion, "w-auto gap-1 rounded-(--pn-r-4) p-1.5")}
      >
        <div role="group" aria-label={label} className="grid grid-cols-5 gap-0.5">
          {GROUP_LABEL_COLORS.map((color) => {
            const selected = color.hex.toLowerCase() === value.toLowerCase()
            return (
              <Hint key={color.hex} label={color.label}>
                <button
                  type="button"
                  aria-label={color.label}
                  aria-pressed={selected}
                  onClick={() => choose(color.hex)}
                  className={swatchButton}
                >
                  <Swatch
                    color={color.hex}
                    custom={false}
                    className={cn(
                      selected && "ring-2 ring-(--pn-accent) ring-offset-2 ring-offset-(--pn-surface-raised)"
                    )}
                  />
                </button>
              </Hint>
            )
          })}
        </div>
        {custom && (
          <button
            type="button"
            aria-pressed
            onClick={() => setOpen(false)}
            className="flex h-9 items-center gap-2 rounded-(--pn-r-2) bg-(--pn-accent-soft) px-2 text-[13px] text-(--pn-fg)"
          >
            <Swatch color={value} custom />
            Custom
            <span className="ml-auto font-mono text-xs text-(--pn-fg-muted)">{value}</span>
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
