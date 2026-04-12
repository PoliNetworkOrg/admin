"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { CalendarIcon, ChevronDownIcon, Plus, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { start } from "repl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserSelect } from "@/components/user-select"
import { useSession } from "@/lib/auth"
import { useTRPC } from "@/lib/trpc/client"
import type { TgUser } from "@/lib/trpc/types"

export function NewGrant() {
  const sesh = useSession()
  const adderId = sesh.data?.user.telegramId

  const trpc = useTRPC()
  const qc = useQueryClient()
  const mutation = useMutation(trpc.tg.grants.create.mutationOptions())

  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<TgUser | null>(null)
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [reason, setReason] = useState<string>("")

  const disabled = !user || !startDate || !endDate || endDate.getTime() < Date.now()

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v === false) {
      setUser(null)
      setStartDate(undefined)
      setEndDate(undefined)
      qc.invalidateQueries(trpc.tg.grants.getOngoing.queryOptions())
      if (user) qc.invalidateQueries(trpc.tg.grants.checkUser.queryOptions({ userId: user.id }))
    }
  }

  const handleDateSelect = useCallback((date: Date, startTime: number, duration: number) => {
    const startDate = new Date(date.getTime())
    startDate.setHours(startTime)
    startDate.setMinutes(0)
    startDate.setSeconds(0)
    setStartDate(startDate)

    const endDate = new Date(startDate.getTime())
    endDate.setTime(endDate.getTime() + duration * 1000)
    endDate.setSeconds(0)
    setEndDate(endDate)
  }, [])

  const isPast = endDate && endDate.getTime() < Date.now()

  async function create() {
    if (!user || !startDate || !endDate || !adderId) return
    const res = await mutation.mutateAsync({
      userId: user.id,
      adderId,
      since: startDate,
      until: endDate,
      reason: reason || undefined,
    })

    if (res.error === "UNAUTHORIZED") toast.error("You don't have permission to create grants.")
    else if (res.error === "ALREADY_EXISTING") toast.error("This user already has an ongoing grant.")
    else if (res.error === "INTERNAL_SERVER_ERROR") toast.error("There was a server error.")
    else toast.success("Grant created successfully!")
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus size={20} /> New Grant
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Grant</DialogTitle>
          <DialogDescription>Make the user admin in a group.</DialogDescription>
        </DialogHeader>

        <UserSelect onUser={(user) => setUser(user)} onReset={() => setUser(null)} />

        <DatePicker onSelect={handleDateSelect} />

        <div className="text-muted-foreground">
          <p>Start Date: {startDate && format(startDate, "yyyy/MM/dd HH:mm")}</p>
          <p>End Date: {endDate && format(endDate, "yyyy/MM/dd HH:mm")}</p>

          {isPast && <p className="text-destructive">The end datetime is in the past</p>}
        </div>

        <div>
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            autoComplete="off"
            value={reason}
            onChange={(v) => setReason(v.target.value)}
            placeholder="Reason for the grant..."
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button disabled={disabled} onClick={create}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DatePicker({ onSelect }: { onSelect: (date: Date, startTime: number, duration: number) => void }) {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [startTime, setStartTime] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [open, setOpen] = useState<boolean>(false)

  const hours = [
    { label: "1h", value: 3600 },
    { label: "2h", value: 7200 },
    { label: "6h", value: 21600 },
    { label: "12h", value: 43200 },
  ]
  const days = [
    { label: "1d", value: 86400 },
    { label: "2d", value: 172800 },
    { label: "7d", value: 604800 },
  ]
  const durations = [{ label: "Select...", value: null }, ...hours, ...days]

  const times = [
    { label: "Select...", value: null },
    ...Array.from({ length: 13 }, (_, i) => ({
      label: `${String(i + 8).padStart(2, "0")}:00`,
      value: i + 8,
    })),
  ]

  useEffect(() => {
    if (date !== undefined && startTime !== null && duration !== null) {
      onSelect(date, startTime, duration)
    }
  }, [date, duration, onSelect, startTime])

  return (
    <FieldGroup className="max-w-xs flex-row">
      <Field>
        <FieldLabel htmlFor="date-picker-optional">Date</FieldLabel>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" id="date-picker-optional" className="w-32 justify-between font-normal">
                {date ? format(date, "PPP") : "Select date"}
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            }
          />
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              timeZone="Europe/Rome"
              mode="single"
              selected={date}
              captionLayout="dropdown"
              defaultMonth={date}
              required
              onSelect={(date) => {
                setDate(date)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="*:w-32">
        <FieldLabel htmlFor="time">Start Time</FieldLabel>
        <Select id="time" items={times} value={startTime} onValueChange={setStartTime}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Time</SelectLabel>
              {times.slice(1).map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="*:w-40">
        <FieldLabel htmlFor="duration">Duration</FieldLabel>
        <Select id="duration" items={durations} value={duration} onValueChange={setDuration}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              <SelectLabel>Hours</SelectLabel>
              {hours.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Days</SelectLabel>
              {days.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  )
}
