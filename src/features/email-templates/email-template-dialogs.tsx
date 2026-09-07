import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, OctagonX } from "lucide-react"
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
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { EmailTemplate } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"

import { addEmailTemplate, deleteEmailTemplate, editEmailTemplate } from "./email-templates.functions"

export function EmailTemplateDialog({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null
  onClose: () => void
  onSaved: (template: EmailTemplate) => void
}) {
  const [subject, setSubject] = useState(template?.subject ?? "")
  const [body, setBody] = useState(template?.body ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const addEmailTemplateFn = useServerFn(addEmailTemplate)
  const editEmailTemplateFn = useServerFn(editEmailTemplate)

  const trimmedSubject = subject.trim()
  const trimmedBody = body.trim()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmedSubject || !trimmedBody) return

    setPending(true)
    setError("")
    try {
      const saved = template
        ? await editEmailTemplateFn({ data: { id: template.id, subject: trimmedSubject, body: trimmedBody } })
        : await addEmailTemplateFn({ data: { subject: trimmedSubject, body: trimmedBody } })
      onSaved(saved)
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The template could not be saved. Check your permissions and try again."))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] overflow-y-auto border-border p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">
            AZURE · EMAIL TEMPLATES
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">
            {template ? "Edit email template" : "New email template"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "Update the predefined subject and body for this template."
              : "Save a predefined subject and body that can be selected when emailing members."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="template-subject">Subject</FieldLabel>
              <Input
                id="template-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Membership renewal reminder"
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="template-body">Body</FieldLabel>
              <Textarea
                id="template-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write the email body…"
                className="h-56 field-sizing-fixed resize-none overflow-y-auto"
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !trimmedSubject || !trimmedBody}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}{" "}
              {template ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteEmailTemplateDialog({
  template,
  onClose,
  onDeleted,
}: {
  template: EmailTemplate
  onClose: () => void
  onDeleted: (id: number) => void
}) {
  const [pending, setPending] = useState(false)
  const deleteEmailTemplateFn = useServerFn(deleteEmailTemplate)

  async function remove() {
    setPending(true)
    try {
      await deleteEmailTemplateFn({ data: { id: template.id } })
      onDeleted(template.id)
    } catch (error) {
      console.error(error)
      toast.error("The template could not be deleted. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <OctagonX />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete email template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{template.subject}</strong>? <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} variant="outline" onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin-slow" /> : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
