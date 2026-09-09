import { useRouter } from "@tanstack/react-router"
import { Mail, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import type { EmailTemplate } from "@/lib/api/types"

import { DeleteEmailTemplateDialog, EmailTemplateDialog } from "./email-template-dialogs"

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length).trimEnd()}…` : value
}

export function EmailTemplatesPage({
  initialTemplates,
  canWrite,
}: {
  initialTemplates: EmailTemplate[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<EmailTemplate | null | "new">(null)
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null)

  useEffect(() => setTemplates(initialTemplates), [initialTemplates])

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return normalized
      ? templates.filter((template) => template.subject.toLocaleLowerCase().includes(normalized))
      : templates
  }, [templates, query])

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the latest template list could not be refreshed.")
    }
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Azure"
        title="Email templates"
        description="Save predefined subject and body text that can be selected when emailing members."
        count={filteredTemplates.length}
        total={templates.length}
        searchPlaceholder="Search by subject…"
        onSearch={setQuery}
        action={
          canWrite ? (
            <Button onClick={() => setEditing("new")}>
              <Plus data-icon="inline-start" /> Add template
            </Button>
          ) : undefined
        }
      />
      {filteredTemplates.length ? (
        <TableSurface>
          <Table className="min-w-[640px] text-left">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <DataTableHead>Subject</DataTableHead>
                <DataTableHead>Body</DataTableHead>
                {canWrite && <DataTableHead className="text-right">Actions</DataTableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                        <Mail className="size-4" />
                      </span>
                      <span className="font-medium">{template.subject}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                    {truncate(template.body, 120)}
                  </TableCell>
                  {canWrite && (
                    <TableCell className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Edit ${template.subject}`}
                          onClick={() => setEditing(template)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          aria-label={`Delete ${template.subject}`}
                          onClick={() => setDeleting(template)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableSurface>
      ) : (
        <EmptyState
          icon={Mail}
          title={templates.length ? "No template matches this search" : "No email templates yet"}
          text={
            templates.length
              ? "Try a different subject."
              : "Save a predefined subject and body so admins can reuse it when emailing members."
          }
          action={
            canWrite && !templates.length ? (
              <Button onClick={() => setEditing("new")}>Add first template</Button>
            ) : undefined
          }
        />
      )}
      {editing && (
        <EmailTemplateDialog
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTemplates((current) =>
              editing === "new" ? [...current, saved] : current.map((t) => (t.id === saved.id ? saved : t))
            )
            setEditing(null)
            toast.success(editing === "new" ? "Template created successfully" : "Template updated successfully")
            void refresh()
          }}
        />
      )}
      {deleting && (
        <DeleteEmailTemplateDialog
          template={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setTemplates((current) => current.filter((template) => template.id !== id))
            setDeleting(null)
            toast.success("Template deleted")
            void refresh()
          }}
        />
      )}
    </div>
  )
}
