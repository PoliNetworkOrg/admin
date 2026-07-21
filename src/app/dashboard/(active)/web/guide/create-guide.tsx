"use client"

import { format } from "date-fns"
import { ChevronDownIcon, Plus, Upload } from "lucide-react"
import { useState } from "react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createGuide } from "@/server/actions/guides"
import type { Guide } from "./types"

export function CreateGuide({
  existingVersions,
  latestVersion,
  onCreated,
}: {
  existingVersions: string[]
  latestVersion?: string
  onCreated: (guide: Guide) => void
}) {
  const [open, setOpen] = useState(false)
  const [version, setVersion] = useState(latestVersion ?? "")
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)

  const trimmedVersion = version.trim()
  const isDuplicate = trimmedVersion.length > 0 && existingVersions.includes(trimmedVersion)
  const disabled = !trimmedVersion || !date || !file || isDuplicate || pending

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v) {
      setVersion(latestVersion ?? "")
      setDate(new Date())
      setFile(null)
    }
  }

  async function handleSubmit() {
    if (!date || !file || isDuplicate) return
    setPending(true)

    try {
      const formData = new FormData()
      formData.set("version", trimmedVersion)
      formData.set("date", date.toISOString())
      formData.set("file", file)
      const { guide, error } = await createGuide(formData)

      if (error === "UNAUTHORIZED") toast.error("You don't have permission to add guides.")
      else if (error === "DUPLICATE_VERSION") toast.error("This version already exists.")
      else if (!guide) toast.error("There was an error creating the guide.")
      else {
        toast.success("Guide created successfully")
        onCreated(guide)
        handleOpenChange(false)
      }
    } catch (err) {
      toast.error("There was an error")
      console.error(err)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus size={20} /> Add Guide
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Guide</DialogTitle>
          <DialogDescription>Upload a new version of the Guida della Matricola.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              autoComplete="off"
              placeholder="1.0"
              value={version}
              required
              aria-invalid={isDuplicate}
              onChange={(e) => setVersion(e.target.value)}
            />
            {isDuplicate && <p className="text-destructive text-sm">This version already exists.</p>}
          </div>

          <Field>
            <FieldLabel htmlFor="date-picker">Date</FieldLabel>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" id="date-picker" className="w-full justify-between font-normal">
                    {date ? format(date, "dd/MM/yyyy") : "Select date"}
                    <ChevronDownIcon data-icon="inline-end" />
                  </Button>
                }
              />
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  captionLayout="dropdown"
                  defaultMonth={date}
                  required
                  onSelect={(d) => {
                    setDate(d)
                    setDatePickerOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </Field>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="file">PDF File</Label>
            <label
              htmlFor="file"
              className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-accent/50"
            >
              <Upload className="size-4 shrink-0 text-muted-foreground" />
              <span className={file ? "truncate" : "truncate text-muted-foreground"}>
                {file ? file.name : "Choose a PDF file..."}
              </span>
            </label>
            <Input
              id="file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button disabled={disabled} onClick={handleSubmit}>
            {pending ? "Saving..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
