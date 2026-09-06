import { Ban, LoaderCircle, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

import type { ReportRow } from "./reports.mock"
import { telegramUserSearchText } from "./telegram-user-link"

async function simulateModerationCall() {
  await new Promise((resolve) => setTimeout(resolve, 400))
}

export function BanDialog({
  report,
  onResolve,
}: {
  report: ReportRow
  onResolve: (resolution: string, reason?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const targetName = telegramUserSearchText(report.target)

  async function confirmBan() {
    setPending(true)
    await simulateModerationCall()
    onResolve("Ban", reason.trim() || undefined)
    toast.success(`${targetName} bannato da ${report.groupTitle}.`)
    setPending(false)
    setOpen(false)
    setReason("")
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Ban data-icon="inline-start" /> Ban
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Bannare {targetName}?</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;utente verrà bannato dal gruppo &quot;{report.groupTitle}&quot;. Questa azione riguarda solo questo
            gruppo e non può essere annullata da qui.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`ban-reason-${report.id}`}>
            Motivo <span className="font-normal text-muted-foreground">(opzionale)</span>
          </FieldLabel>
          <Textarea
            id={`ban-reason-${report.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Perché viene bannato?"
            maxLength={500}
            disabled={pending}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void confirmBan()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />} Conferma ban
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function BanAllDialog({
  report,
  onResolve,
}: {
  report: ReportRow
  onResolve: (resolution: string, reason?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)
  const targetName = telegramUserSearchText(report.target)

  async function confirmBanAll() {
    setPending(true)
    await simulateModerationCall()
    onResolve("Ban all", reason.trim() || undefined)
    toast.success(`Ban all avviato per ${targetName} su tutti i gruppi.`)
    setPending(false)
    setOpen(false)
    setReason("")
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <ShieldAlert data-icon="inline-start" /> Ban all
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Avviare il ban all per {targetName}?</AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;utente verrà bannato da tutti i gruppi gestiti dal bot, non solo da &quot;{report.groupTitle}
            &quot;. È un&apos;operazione estesa e non può essere annullata da qui.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`ban-all-reason-${report.id}`}>
            Motivo <span className="font-normal text-muted-foreground">(opzionale)</span>
          </FieldLabel>
          <Textarea
            id={`ban-all-reason-${report.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Perché viene bannato da tutti i gruppi?"
            maxLength={500}
            disabled={pending}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void confirmBanAll()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />} Conferma ban all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
