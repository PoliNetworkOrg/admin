import { CalendarIcon, Clock3 } from "lucide-react"
import { type ReactNode, useEffect, useMemo, useState } from "react"

import {
  buttonMotion,
  fieldControl,
  fieldHintId,
  floatingMotion,
  FormField,
  raisedSurface,
  SegmentedControl,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { WheelPicker, WheelPickerColumn } from "@/components/ui/wheel-picker"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Parses the `datetime-local` format ("2026-10-06T09:30") in local time. */
export function parseLocalDateTime(value: string) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value)
  if (!match) return undefined
  const [, year, month, day, hours, minutes] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function localDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Grants may start at the earliest at midnight today. */
export function earliestGrantStart() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function clampToMinimum(date: Date, minimum?: Date) {
  return minimum && date < minimum ? new Date(minimum) : date
}

/** Native `datetime-local` on touch devices; the calendar and wheel popovers on fine pointers. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)")
    setCoarse(query.matches)
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return coarse
}

const HOUR_VALUES = Array.from({ length: 24 }, (_, hour) => pad(hour))
const MINUTE_VALUES = Array.from({ length: 60 }, (_, minute) => pad(minute))

const pickerButton = cn(
  buttonMotion,
  "h-9 justify-start gap-2 border-(--pn-line-strong) bg-(--pn-surface) px-3 text-sm font-normal text-(--pn-fg) shadow-none hover:bg-(--pn-muted) aria-invalid:border-(--pn-danger-solid) [&_svg]:text-(--pn-fg-muted)"
)

type DateTimeInputProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  minimum?: Date
  invalid: boolean
  disabled: boolean
}

function DesktopDateTimeInput({ id, label, value, onChange, minimum, invalid, disabled }: DateTimeInputProps) {
  const selected = parseLocalDateTime(value)
  const [dateOpen, setDateOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [draft, setDraft] = useState(() => clampToMinimum(selected ?? new Date(), minimum))

  function updateTimeOpen(next: boolean) {
    if (next) setDraft(clampToMinimum(selected ?? new Date(), minimum))
    setTimeOpen(next)
  }

  function chooseDate(date: Date | undefined) {
    if (!date) return
    const next = new Date(date)
    next.setHours(selected?.getHours() ?? 0, selected?.getMinutes() ?? 0, 0, 0)
    onChange(localDateTimeValue(clampToMinimum(next, minimum)))
    setDateOpen(false)
  }

  function chooseHour(hour: string) {
    const next = new Date(draft)
    next.setHours(Number(hour))
    setDraft(clampToMinimum(next, minimum))
  }

  function chooseMinute(minute: string) {
    const next = new Date(draft)
    next.setMinutes(Number(minute))
    setDraft(clampToMinimum(next, minimum))
  }

  const hourOptions = useMemo(
    () =>
      HOUR_VALUES.map((hour) => {
        const endOfHour = new Date(draft)
        endOfHour.setHours(Number(hour), 59, 59, 999)
        return { value: hour, disabled: Boolean(minimum && sameLocalDay(draft, minimum) && endOfHour < minimum) }
      }),
    [draft, minimum]
  )

  const minuteOptions = useMemo(
    () =>
      MINUTE_VALUES.map((minute) => {
        const candidate = new Date(draft)
        candidate.setMinutes(Number(minute), 0, 0)
        return { value: minute, disabled: Boolean(minimum && sameLocalDay(draft, minimum) && candidate < minimum) }
      }),
    [draft, minimum]
  )

  const describedBy = invalid ? fieldHintId(id) : undefined

  return (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_96px] gap-2">
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={pickerButton}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              disabled={disabled}
            />
          }
        >
          <CalendarIcon aria-hidden data-icon="inline-start" />
          {selected ? (
            <span className="tabular-nums">{formatDate(selected)}</span>
          ) : (
            <span className="text-(--pn-fg-subtle)">Choose {label.toLocaleLowerCase()}</span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className={cn(raisedSurface, floatingMotion, "w-auto rounded-(--pn-r-4) p-0")}>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minimum}
            disabled={
              minimum ? { before: new Date(minimum.getFullYear(), minimum.getMonth(), minimum.getDate()) } : undefined
            }
            onSelect={chooseDate}
            className="bg-transparent"
          />
        </PopoverContent>
      </Popover>
      <Popover open={timeOpen} onOpenChange={updateTimeOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={pickerButton}
              aria-label={`${label} time, 24-hour format`}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              disabled={disabled}
            />
          }
        >
          <Clock3 aria-hidden data-icon="inline-start" />
          <span className={cn("font-mono tabular-nums", !selected && "text-(--pn-fg-subtle)")}>
            {selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : "--:--"}
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className={cn(raisedSurface, floatingMotion, "w-44 gap-2 rounded-(--pn-r-4) p-2")}>
          <p className="px-1 text-xs text-(--pn-fg-muted)">24-hour time</p>
          <WheelPicker aria-label={`${label} time`} itemHeight={30} visibleCount={3}>
            <WheelPickerColumn
              aria-label="Hour"
              options={hourOptions}
              value={pad(draft.getHours())}
              onChange={chooseHour}
              loop
            />
            <span aria-hidden className="flex items-center font-mono text-(--pn-fg-muted)">
              :
            </span>
            <WheelPickerColumn
              aria-label="Minute"
              options={minuteOptions}
              value={pad(draft.getMinutes())}
              onChange={chooseMinute}
              loop
            />
          </WheelPicker>
          <Button
            type="button"
            size="sm"
            className={cn(buttonMotion, "w-full")}
            onClick={() => {
              onChange(localDateTimeValue(draft))
              setTimeOpen(false)
            }}
          >
            Done
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function DateTimeInput(props: DateTimeInputProps) {
  const coarse = useCoarsePointer()
  if (!coarse) return <DesktopDateTimeInput {...props} />
  const { id, value, onChange, minimum, invalid, disabled } = props
  return (
    <Input
      id={id}
      type="datetime-local"
      min={minimum ? localDateTimeValue(minimum) : undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? fieldHintId(id) : undefined}
      disabled={disabled}
      className={cn("h-9 min-w-0 flex-1 [inline-size:-webkit-fill-available]", fieldControl)}
    />
  )
}

const DURATIONS = [
  { label: "2h", hours: 2 },
  { label: "6h", hours: 6 },
  { label: "12h", hours: 12 },
  { label: "1d", hours: 24 },
]

const HOUR_MS = 60 * 60 * 1000

export type GrantDateTimeFieldsProps = {
  validSince: string
  validUntil: string
  onValidSinceChange: (value: string) => void
  onValidUntilChange: (value: string) => void
  minimumSince: Date
  minimumUntil: Date
  invalidStart: boolean
  invalidEnd: boolean
}

/** "Valid from" with a Now shortcut and "Valid until" with duration shortcuts (§7.4). */
export function GrantDateTimeFields({
  validSince,
  validUntil,
  onValidSinceChange,
  onValidUntilChange,
  minimumSince,
  minimumUntil,
  invalidStart,
  invalidEnd,
}: GrantDateTimeFieldsProps) {
  const start = parseLocalDateTime(validSince)
  const end = parseLocalDateTime(validUntil)
  const activeDuration =
    start && end
      ? DURATIONS.find((duration) => end.getTime() - start.getTime() === duration.hours * HOUR_MS)
      : undefined

  function setDuration(label: string) {
    const duration = DURATIONS.find((item) => item.label === label)
    if (!start || !duration) return
    onValidUntilChange(localDateTimeValue(new Date(start.getTime() + duration.hours * HOUR_MS)))
  }

  return (
    <>
      <FormField
        label="Valid from"
        htmlFor="grant-valid-since"
        error={invalidStart ? "Choose today or a future date." : undefined}
      >
        <Row>
          <DateTimeInput
            id="grant-valid-since"
            label="Valid from"
            value={validSince}
            onChange={onValidSinceChange}
            minimum={minimumSince}
            invalid={invalidStart}
            disabled={false}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(buttonMotion, "w-[176px] justify-center text-(--pn-fg-muted) hover:text-(--pn-fg)")}
            onClick={() => onValidSinceChange(localDateTimeValue(new Date()))}
          >
            Now
          </Button>
        </Row>
      </FormField>
      <FormField
        label="Valid until"
        htmlFor="grant-valid-until"
        error={invalidEnd ? "Choose a time after the grant starts." : undefined}
      >
        <Row>
          <DateTimeInput
            id="grant-valid-until"
            label="Valid until"
            value={validUntil}
            onChange={onValidUntilChange}
            minimum={minimumUntil}
            invalid={invalidEnd}
            disabled={!validSince}
          />
          <SegmentedControl
            label="Grant duration shortcuts"
            items={DURATIONS.map((duration) => ({
              value: duration.label,
              label: duration.label,
              ariaLabel: `Set grant duration to ${duration.label}`,
            }))}
            value={activeDuration?.label ?? null}
            onValueChange={setDuration}
            disabled={!start || invalidStart}
            // Same 176px as the "Now" button above, so both rows' pickers line up.
            className="w-[176px]"
            itemClassName="flex-1 px-0 tabular-nums"
          />
        </Row>
      </FormField>
    </>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 min-[480px]:flex-nowrap">{children}</div>
}
