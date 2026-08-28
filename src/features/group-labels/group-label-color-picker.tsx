import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { GROUP_LABEL_COLORS, type GroupLabelColorName, isGroupLabelColorName } from "./group-labels.constants"

export function GroupLabelColorPicker({
  value,
  onChange,
}: {
  value: GroupLabelColorName
  onChange: (color: GroupLabelColorName) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(val) => {
        if (val && isGroupLabelColorName(val)) onChange(val)
      }}
    >
      <SelectTrigger aria-label="Label color" className="w-auto shrink-0 px-2">
        <SelectValue>
          <span
            className={cn("size-3.5 rounded-full", GROUP_LABEL_COLORS.find((color) => color.name === value)?.dot)}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto p-2" align="start">
        <SelectGroup className="grid grid-cols-5 gap-1 p-1">
          {GROUP_LABEL_COLORS.map((color) => (
            <SelectItem
              key={color.name}
              value={color.name}
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
