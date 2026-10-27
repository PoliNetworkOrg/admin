import { ChevronDown, FolderUp, Mail } from "lucide-react"
import { type ReactNode, type RefObject, useEffect, useId, useRef } from "react"

import { buttonMotion, FormField, fieldControl, fieldHintId, Reveal } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { EsignDrive } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { savedToText } from "./composer"
import { FieldError } from "./composer-fields"
import { DriveBrowser, type DriveFolder } from "./drive-browser"

/** How long `Reveal` takes to open a row. */
export const REVEAL_MS = 200

/** The save row: closed on its summary, open on the file name ("fields") or on the folder browser ("browse"). */
export type SaveView = "closed" | "fields" | "browse"

type DeliveryRowsProps = {
  /** The configured drives; without any, there is no save row. */
  drives: EsignDrive[]
  driveLabel: (driveId: string) => string
  saveToDrive: boolean
  folder: DriveFolder | null
  fileName: string
  saveView: SaveView
  onSaveView: (view: SaveView) => void
  /** "Save here" in the browser. */
  onFolder: (folder: DriveFolder) => void
  onDontSave: () => void
  onFileName: (name: string) => void
  onFileNameBlur: () => void
  folderError?: string
  fileNameError?: string
  emails: string
  recipients: string[]
  onEmails: (emails: string) => void
  onEmailsBlur: () => void
  emailError?: string
  emailOpen: boolean
  onEmailOpen: (open: boolean) => void
  message: string
  onMessage: (message: string) => void
}

/**
 * Where the signed PDF goes, as two summary rows in the request page's words. Each opens its fields below it, by a
 * click or by itself when a check fails; the summary stays on the row, updated as the fields change.
 */
export function DeliveryRows(props: DeliveryRowsProps) {
  const { drives, saveView, onSaveView, emailOpen, onEmailOpen } = props
  const savePanel = useRef<HTMLDivElement>(null)
  const emailPanel = useRef<HTMLDivElement>(null)
  const saveRow = useRef<HTMLButtonElement>(null)
  /** The row just opened with a click: its first field takes the focus, and the column scrolls to show it. */
  const opened = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const panel = opened.current
    if (!panel || !(saveView !== "closed" || emailOpen)) return
    opened.current = null
    panel.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true })
    const timer = window.setTimeout(() => panel.scrollIntoView({ block: "nearest" }), REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [saveView, emailOpen])

  /** Back on the row after its fields closed or changed under the focus. */
  function settle(view: SaveView) {
    onSaveView(view)
    saveRow.current?.focus()
  }

  return (
    <div className="flex flex-col">
      {drives.length > 0 && (
        <SaveRow
          {...props}
          rowRef={saveRow}
          panelRef={savePanel}
          onToggle={() => {
            if (saveView !== "closed") return onSaveView("closed")
            opened.current = savePanel.current
            onSaveView(props.saveToDrive && props.folder ? "fields" : "browse")
          }}
          onChangeFolder={() => settle("browse")}
          onDontSave={() => {
            props.onDontSave()
            settle("closed")
          }}
          onFolder={(folder) => {
            props.onFolder(folder)
            settle("closed")
          }}
        />
      )}
      <EmailRow
        {...props}
        panelRef={emailPanel}
        onToggle={() => {
          if (!emailOpen) opened.current = emailPanel.current
          onEmailOpen(!emailOpen)
        }}
      />
    </div>
  )
}

function SaveRow({
  drives,
  driveLabel,
  saveToDrive,
  folder,
  fileName,
  saveView,
  folderError,
  fileNameError,
  onFileName,
  onFileNameBlur,
  rowRef,
  panelRef,
  onToggle,
  onChangeFolder,
  onDontSave,
  onFolder,
}: DeliveryRowsProps & {
  rowRef: RefObject<HTMLButtonElement | null>
  panelRef: RefObject<HTMLDivElement | null>
  onToggle: () => void
  onChangeFolder: () => void
}) {
  const panelId = useId()
  const fileNameId = useId()
  const folderErrorId = useId()
  const dontSave = (
    <Button variant="ghost" size="sm" className={buttonMotion} onClick={onDontSave}>
      Don't save to OneDrive
    </Button>
  )
  return (
    <div>
      <SummaryRow
        rowRef={rowRef}
        icon={FolderUp}
        open={saveView !== "closed"}
        panelId={panelId}
        onToggle={onToggle}
        describedBy={folderError ? folderErrorId : undefined}
      >
        {!saveToDrive ? (
          <span className="text-(--pn-fg-muted)">Kept in the dashboard only</span>
        ) : folder ? (
          savedToText(driveLabel(folder.driveId), folder.path, fileName.trim())
        ) : (
          "Choose where to save the signed PDF"
        )}
      </SummaryRow>
      {folderError && (
        <div className="pb-1 pl-[34px]">
          <FieldError id={folderErrorId}>{folderError}</FieldError>
        </div>
      )}
      <div ref={panelRef} id={panelId} className="scroll-m-3">
        <Reveal open={saveView !== "closed"} lazy>
          {saveView === "browse" ? (
            <div
              data-invalid={folderError ? true : undefined}
              data-folder-browser
              tabIndex={-1}
              className="scroll-m-3 px-2 pt-2 pb-1 outline-none"
            >
              <DriveBrowser
                mode="folder"
                label="Folders"
                drives={drives}
                initialDriveId={folder?.driveId}
                initialFolderId={folder?.id}
                embedded
                footerStart={saveToDrive && dontSave}
                onPickFolder={onFolder}
                className={cn("h-[250px]", folderError && "border-(--pn-danger-solid)")}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 px-2 pt-2 pb-1">
              <FormField label="File name" htmlFor={fileNameId} error={fileNameError}>
                <Input
                  id={fileNameId}
                  className={cn(fieldControl, "h-9 scroll-m-3")}
                  value={fileName}
                  maxLength={200}
                  spellCheck={false}
                  aria-invalid={fileNameError ? true : undefined}
                  aria-describedby={fileNameError ? fieldHintId(fileNameId) : undefined}
                  onChange={(event) => onFileName(event.target.value)}
                  onBlur={onFileNameBlur}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className={buttonMotion} onClick={onChangeFolder}>
                  Change folder
                </Button>
                {dontSave}
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </div>
  )
}

function EmailRow({
  emails,
  recipients,
  onEmails,
  onEmailsBlur,
  emailError,
  emailOpen,
  message,
  onMessage,
  panelRef,
  onToggle,
}: DeliveryRowsProps & { panelRef: RefObject<HTMLDivElement | null>; onToggle: () => void }) {
  const panelId = useId()
  const emailsId = useId()
  const messageId = useId()
  return (
    <div>
      <SummaryRow icon={Mail} open={emailOpen} panelId={panelId} onToggle={onToggle}>
        {recipients.length > 0 ? (
          `Will be emailed to ${recipients.join(", ")}`
        ) : (
          <span className="text-(--pn-fg-muted)">No email</span>
        )}
      </SummaryRow>
      <div ref={panelRef} id={panelId} className="scroll-m-3">
        <Reveal open={emailOpen} lazy>
          <div className="flex flex-col gap-3 px-2 pt-2 pb-1">
            <FormField label="Email the signed PDF to" htmlFor={emailsId} optional error={emailError}>
              <Input
                id={emailsId}
                className={cn(fieldControl, "h-9 scroll-m-3")}
                value={emails}
                inputMode="email"
                spellCheck={false}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? fieldHintId(emailsId) : undefined}
                onChange={(event) => onEmails(event.target.value)}
                onBlur={onEmailsBlur}
              />
            </FormField>
            {recipients.length > 0 && (
              <FormField label="Message" htmlFor={messageId} optional>
                <Textarea
                  id={messageId}
                  className={cn(fieldControl, "min-h-[76px]")}
                  rows={3}
                  value={message}
                  maxLength={2000}
                  onChange={(event) => onMessage(event.target.value)}
                />
              </FormField>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  )
}

/** A summary line that opens its fields: icon, the full text (wrapped, never cut) and a chevron. */
function SummaryRow({
  icon: Icon,
  open,
  panelId,
  onToggle,
  describedBy,
  rowRef,
  children,
}: {
  icon: typeof Mail
  open: boolean
  panelId: string
  onToggle: () => void
  describedBy?: string
  rowRef?: RefObject<HTMLButtonElement | null>
  children: ReactNode
}) {
  return (
    <button
      ref={rowRef}
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      aria-describedby={describedBy}
      onClick={onToggle}
      className="flex min-h-10 w-full items-start gap-2.5 rounded-(--pn-r-3) px-2 py-2.5 text-left text-[14px]/5 text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-hover)"
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-fg-muted)" />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
      <ChevronDown
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0 text-(--pn-fg-muted) transition-transform duration-200 ease-(--pn-ease-move)",
          open && "rotate-180"
        )}
      />
    </button>
  )
}
