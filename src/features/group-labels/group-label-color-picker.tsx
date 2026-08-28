import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { getGroupLabelColor, GROUP_LABEL_COLORS } from "./group-labels.constants"

export function GroupLabelColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const swatch = getGroupLabelColor(value)

  return (
    <Select value={value} onValueChange={(val) => val && onChange(val)}>
      <SelectTrigger aria-label="Label color" className="w-auto shrink-0 px-2">
        <SelectValue>
          <span
            className={cn("size-3.5 rounded-full", swatch.dotClassName)}
            style={swatch.dotStyle}
            title={swatch.label}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto p-2" align="start">
        <SelectGroup className="grid grid-cols-5 gap-1 p-1">
          {GROUP_LABEL_COLORS.map((color) => (
            <SelectItem
              key={color.hex}
              value={color.hex}
              title={color.label}
              className="flex size-8 items-center justify-center rounded-md p-0 pr-0 cursor-pointer hover:bg-accent focus:bg-accent data-selected:bg-accent data-selected:ring-2 data-selected:ring-primary/60 [&>span:last-child]:hidden"
            >
              <span className={cn("size-4 rounded-full", color.dot)} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
