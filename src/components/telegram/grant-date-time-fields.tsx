import { CalendarIcon, Clock3Icon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { WheelPicker, WheelPickerColumn } from "@/components/ui/wheel-picker"

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function parseLocalDateTime(value: string) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value)
  if (!match) return undefined

  const [, year, month, day, hours, minutes] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function localDatePart(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function localDateTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${localDatePart(date)}T${hours}:${minutes}`
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

function isMobileDateTimePickerDevice() {
  const userAgent = navigator.userAgent
  const iPadOSDesktopMode = /Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || iPadOSDesktopMode
}

function useNativeDateTimePicker() {
  const [nativePicker, setNativePicker] = useState(false)

  useEffect(() => {
    setNativePicker(isMobileDateTimePickerDevice())
  }, [])

  return nativePicker
}

export type AdaptiveDateTimeFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  invalid?: boolean
  error?: React.ReactNode
  required?: boolean
  disabled?: boolean
}

type DesktopDateTimePickerProps = Pick<
  AdaptiveDateTimeFieldProps,
  "id" | "label" | "value" | "onChange" | "invalid" | "disabled"
> & {
  minimum?: Date
}

const HOUR_VALUES = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))
const MINUTE_VALUES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"))

function DesktopDateTimePicker({
  id,
  label,
  value,
  onChange,
  minimum,
  invalid = false,
  disabled = false,
}: DesktopDateTimePickerProps) {
  const selected = parseLocalDateTime(value)
  const [dateOpen, setDateOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [draft, setDraft] = useState(() => clampToMinimum(selected ?? new Date(), minimum))

  const updateTimeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft(clampToMinimum(selected ?? new Date(), minimum))
    }
    setTimeOpen(nextOpen)
  }

  const chooseDate = (date: Date | undefined) => {
    if (!date) return

    const next = new Date(date)
    next.setHours(selected?.getHours() ?? 0, selected?.getMinutes() ?? 0, 0, 0)
    onChange(localDateTimeValue(clampToMinimum(next, minimum)))
    setDateOpen(false)
  }

  const chooseHour = (hour: string) => {
    const next = new Date(draft)
    next.setHours(Number(hour))
    setDraft(clampToMinimum(next, minimum))
  }

  const chooseMinute = (minute: string) => {
    const next = new Date(draft)
    next.setMinutes(Number(minute))
    setDraft(clampToMinimum(next, minimum))
  }

  const hourOptions = useMemo(
    () =>
      HOUR_VALUES.map((hour) => {
        const endOfHour = new Date(draft)
        endOfHour.setHours(Number(hour), 59, 59, 999)
        return {
          value: hour,
          disabled: Boolean(minimum && sameLocalDay(draft, minimum) && endOfHour < minimum),
        }
      }),
    [draft, minimum]
  )

  const minuteOptions = useMemo(
    () =>
      MINUTE_VALUES.map((minute) => {
        const candidate = new Date(draft)
        candidate.setMinutes(Number(minute), 0, 0)
        return {
          value: minute,
          disabled: Boolean(minimum && sameLocalDay(draft, minimum) && candidate < minimum),
        }
      }),
    [draft, minimum]
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className="justify-start font-normal"
              aria-invalid={invalid}
              disabled={disabled}
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {selected
            ? selected.toLocaleDateString(undefined, { dateStyle: "medium" })
            : `Choose ${label.toLocaleLowerCase()}`}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minimum}
            disabled={
              minimum
                ? {
                    before: new Date(minimum.getFullYear(), minimum.getMonth(), minimum.getDate()),
                  }
                : undefined
            }
            onSelect={chooseDate}
          />
        </PopoverContent>
      </Popover>
      <Popover open={timeOpen} onOpenChange={updateTimeOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="justify-start font-mono font-normal"
              aria-label={`${label} time, 24-hour format`}
              aria-invalid={invalid}
              disabled={disabled}
            />
          }
        >
          <Clock3Icon data-icon="inline-start" />
          {selected
            ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
            : "--:--"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40 p-2">
          <p className="px-1 font-mono text-[10px] text-muted-foreground">24-hour time</p>
          <WheelPicker aria-label={`${label} time`} itemHeight={30} visibleCount={3}>
            <WheelPickerColumn
              aria-label="Hour"
              options={hourOptions}
              value={String(draft.getHours()).padStart(2, "0")}
              onChange={chooseHour}
              loop
            />
            <span aria-hidden className="flex items-center font-mono text-muted-foreground">
              :
            </span>
            <WheelPickerColumn
              aria-label="Minute"
              options={minuteOptions}
              value={String(draft.getMinutes()).padStart(2, "0")}
              onChange={chooseMinute}
              loop
            />
          </WheelPicker>
          <Separator />
          <Button
            type="button"
            size="sm"
            className="w-full"
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

export function AdaptiveDateTimeField({
  id,
  label,
  value,
  onChange,
  min,
  invalid = false,
  error,
  required = false,
  disabled = false,
}: AdaptiveDateTimeFieldProps) {
  const nativePicker = useNativeDateTimePicker()
  const minimum = min ? parseLocalDateTime(min) : undefined

  return (
    <Field data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {nativePicker ? (
        <Input
          id={id}
          type="datetime-local"
          min={min}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          required={required}
          disabled={disabled}
          className="max-w-full [inline-size:-webkit-fill-available]"
        />
      ) : (
        <DesktopDateTimePicker
          id={id}
          label={label}
          value={value}
          onChange={onChange}
          minimum={minimum}
          invalid={invalid}
          disabled={disabled}
        />
      )}
      {invalid && error}
    </Field>
  )
}

export type GrantDateTimeFieldsProps = {
  validSince: string
  validUntil: string
  onValidSinceChange: (value: string) => void
  onValidUntilChange: (value: string) => void
  minimumSince: string
  minimumUntil: string
  invalidStart: boolean
  invalidEnd: boolean
}

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
  const setDuration = (hours: number) => {
    const start = parseLocalDateTime(validSince)
    if (!start) return
    onValidUntilChange(localDateTimeValue(new Date(start.getTime() + hours * 60 * 60 * 1000)))
  }

  return (
    <>
      <AdaptiveDateTimeField
        id="grant-valid-since"
        label="Valid from"
        min={minimumSince}
        value={validSince}
        onChange={onValidSinceChange}
        invalid={invalidStart}
        error={<p className="text-[10px] text-destructive">Choose today or a future date.</p>}
        required
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="-mt-2 h-7 font-mono text-xs"
        onClick={() => onValidSinceChange(localDateTimeValue(new Date()))}
      >
        Now
      </Button>
      <AdaptiveDateTimeField
        id="grant-valid-until"
        label="Valid until"
        min={minimumUntil}
        value={validUntil}
        onChange={onValidUntilChange}
        invalid={invalidEnd}
        error={<p className="text-[10px] text-destructive">Choose a time after the grant starts.</p>}
        required
        disabled={!validSince}
      />
      <fieldset className="-mt-2 grid grid-cols-4 gap-2" aria-label="Grant duration shortcuts">
        {[
          { label: "2h", hours: 2 },
          { label: "6h", hours: 6 },
          { label: "12h", hours: 12 },
          { label: "1d", hours: 24 },
        ].map(({ label, hours }) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 font-mono text-xs"
            disabled={!validSince || invalidStart}
            onClick={() => setDuration(hours)}
            aria-label={`Set grant duration to ${label}`}
          >
            {label}
          </Button>
        ))}
      </fieldset>
    </>
  )
}
