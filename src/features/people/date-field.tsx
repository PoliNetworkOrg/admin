import { CalendarIcon } from "lucide-react"
import { useRef, useState } from "react"

import { buttonMotion, fieldControl, floatingMotion, raisedSurface } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { dateOnlyValue, parseDateOnly } from "@/lib/date-only"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { SelectField } from "./people-ui"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({ value: String(index), label }))

/** A custom calendar at every viewport; its stored value is ISO, its visible date matches the rest of the app. */
export function DateField({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
  disabled = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
}) {
  const selected = parseDateOnly(value)
  const [open, setOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(() => selected ?? new Date())
  const firstYear = Math.min(1900, month.getFullYear())
  const lastYear = Math.max(new Date().getFullYear() + 10, month.getFullYear())
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const year = String(lastYear - index)
    return { value: year, label: year }
  })

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setMonth(selected ?? new Date())
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(buttonMotion, fieldControl, "w-full justify-start gap-2 px-3 font-normal")}
          />
        }
      >
        <CalendarIcon aria-hidden className="text-(--pn-fg-muted)" />
        <span className={cn("tabular-nums", !selected && "text-(--pn-fg-subtle)")}>
          {selected ? formatDate(selected, "local") : "Choose a date"}
        </span>
      </PopoverTrigger>
      <PopoverContent
        ref={popupRef}
        align="start"
        initialFocus={() => popupRef.current?.querySelector<HTMLElement>('[data-day][tabindex="0"]') ?? true}
        className={cn(raisedSurface, floatingMotion, "w-[304px] max-w-[calc(100vw-32px)] gap-0 rounded-(--pn-r-4) p-2")}
      >
        <PopoverTitle className="sr-only">Choose a date</PopoverTitle>
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 px-1 pb-2">
          <div>
            <label className="sr-only" htmlFor={`${id}-month`}>
              Month
            </label>
            <SelectField
              id={`${id}-month`}
              value={String(month.getMonth())}
              options={MONTHS}
              onChange={(next) => setMonth(new Date(month.getFullYear(), Number(next), 1))}
            />
          </div>
          <div>
            <label className="sr-only" htmlFor={`${id}-year`}>
              Year
            </label>
            <SelectField
              id={`${id}-year`}
              value={String(month.getFullYear())}
              options={years}
              onChange={(next) => setMonth(new Date(Number(next), month.getMonth(), 1))}
            />
          </div>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => {
            if (!date) return
            onChange(dateOnlyValue(date))
            setOpen(false)
          }}
          autoFocus
          weekStartsOn={1}
          className="w-full bg-transparent [--cell-size:--spacing(10)]"
          classNames={{ month_caption: "sr-only", nav: "hidden", months: "w-full" }}
        />
      </PopoverContent>
    </Popover>
  )
}
