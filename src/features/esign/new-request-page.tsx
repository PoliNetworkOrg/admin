import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowDown, ArrowUp, Cloud, FileUp, MapPin, Search, Trash2, UserPlus } from "lucide-react"
import { type DragEvent, useEffect, useId, useMemo, useState } from "react"

import {
  checkboxControl,
  FormField,
  fieldControl,
  IconButton,
  InlineAlert,
  LoadingButton,
  SectionCard,
} from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { EsignConfig, EsignPdfInfo, EsignProfile } from "@/lib/api/types"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { DriveBrowser } from "./drive-browser"
import { getEsignDocumentContent } from "./esign.functions"
import { extractTextAnchors, type PageSize, PdfViewer, sizeOnPage, type TextAnchor, usePdfBytes } from "./pdf-viewer"
import { createEsignRequest, importEsignDriveDocument, uploadEsignDocument } from "./requests.functions"
import { type BoxPlacement, SignatureBox } from "./signature-box"

type Staged = { id: string; fileName: string; pdf: EsignPdfInfo; folder: { id: string; path: string } | null }
/** `manual`: the user moved the box, so a role no longer places it. */
type SignerDraft = { sub: string; name: string; role: string; placement: BoxPlacement; manual: boolean }

const ROLES = ["Presidente", "Vicepresidente", "Segretario", "Tesoriere", "Consigliere", "Socio"]
/** A signature box of 190 × 62 pt, the size of a typical handwritten-signature space. */
const BOX_PT = { width: 190, height: 62 }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Default places: the last page's bottom, two per row, from the bottom-right corner. */
function defaultPlacement(index: number, pages: PageSize[]): BoxPlacement {
  const page = Math.max(pages.length - 1, 0)
  const size = sizeOnPage(pages[page] ?? { width: 595, height: 842 }, BOX_PT.width, BOX_PT.height)
  const column = index % 2
  const row = Math.floor(index / 2)
  const x = column === 0 ? 1 - 0.07 - size.width : 0.07
  const y = Math.max(0.02, 1 - 0.07 - size.height - row * (size.height + 0.03))
  return { page, x, y, ...size }
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase()

/**
 * Where a role's signature goes: under the last label naming it ("Il Segretario", "Firma del Presidente"), or above it
 * when the label sits at the bottom of the page. Null when the document doesn't name the role.
 */
function placementForRole(role: string, anchors: TextAnchor[], pages: PageSize[]): BoxPlacement | null {
  const word = fold(role.trim())
  if (word.length < 4) return null
  const anchor = anchors.findLast((a) => fold(a.text).includes(word))
  const page = anchor ? pages[anchor.page] : undefined
  if (!anchor || !page) return null
  const size = sizeOnPage(page, BOX_PT.width, BOX_PT.height)
  const center = anchor.x + anchor.width / 2
  const x = Math.min(Math.max(center - size.width / 2, 0.02), 1 - size.width - 0.02)
  const below = anchor.y + anchor.height + 0.008
  const y = below + size.height <= 0.98 ? below : Math.max(0.02, anchor.y - size.height - 0.008)
  return { page: anchor.page, x, y, ...size }
}

function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "")
}

export function NewEsignRequestPage({
  config,
  signers: people,
  me,
}: {
  config: EsignConfig
  signers: EsignProfile[]
  me: string
}) {
  const navigate = useNavigate()
  const uploadFn = useServerFn(uploadEsignDocument)
  const importFn = useServerFn(importEsignDriveDocument)
  const contentFn = useServerFn(getEsignDocumentContent)
  const createFn = useServerFn(createEsignRequest)
  const ids = { title: useId(), file: useId(), emails: useId(), message: useId(), search: useId(), roles: useId() }

  const [source, setSource] = useState<"drive" | "upload">(config.drive ? "drive" : "upload")
  const [staged, setStaged] = useState<Staged | null>(null)
  const [base64, setBase64] = useState<string | null>(null)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const bytes = usePdfBytes(base64)
  const [anchors, setAnchors] = useState<TextAnchor[]>([])
  useEffect(() => {
    if (!bytes) return setAnchors([])
    let cancelled = false
    extractTextAnchors(bytes)
      .then((found) => {
        if (!cancelled) setAnchors(found)
      })
      .catch((error) => console.error(error))
    return () => {
      cancelled = true
    }
  }, [bytes])

  const [signers, setSigners] = useState<SignerDraft[]>([])
  const [placing, setPlacing] = useState<number | null>(null)
  const [ordered, setOrdered] = useState(true)
  const [search, setSearch] = useState("")

  const [title, setTitle] = useState("")
  const [saveToDrive, setSaveToDrive] = useState(Boolean(config.drive))
  const [folder, setFolder] = useState<{ id: string; path: string } | null>(null)
  const [choosingFolder, setChoosingFolder] = useState(false)
  const [fileName, setFileName] = useState("")
  const [emails, setEmails] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)

  const pages = staged?.pdf.pages ?? []

  function adopt(next: Staged, content: string) {
    setStaged(next)
    setBase64(content)
    setTitle(baseName(next.fileName))
    setFileName(`${baseName(next.fileName)} - firmato.pdf`)
    if (next.folder) setFolder(next.folder)
    setSigners((current) => current.map((s, i) => ({ ...s, placement: defaultPlacement(i, next.pdf.pages) })))
  }

  async function upload(file: File) {
    setDocError(null)
    if (!file.name.toLowerCase().endsWith(".pdf")) return setDocError("Choose a PDF file.")
    if (file.size > config.maxPdfBytes) return setDocError("The PDF is larger than 30 MB.")
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      const result = await uploadFn({ data: form })
      const buffer = new Uint8Array(await file.arrayBuffer())
      let binary = ""
      for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
      adopt({ id: result.document.id, fileName: result.document.fileName, pdf: result.pdf, folder: null }, btoa(binary))
    } catch (error) {
      console.error(error)
      setDocError(error instanceof Error ? error.message : "Couldn't upload the PDF.")
    } finally {
      setUploading(false)
    }
  }

  async function importFromDrive(itemId: string, from: { id: string; path: string }) {
    setDocError(null)
    setBusyItem(itemId)
    try {
      const result = await importFn({ data: { itemId } })
      const content = await contentFn({ data: { documentId: result.document.id } })
      adopt(
        { id: result.document.id, fileName: result.document.fileName, pdf: result.pdf, folder: from },
        content.base64
      )
    } catch (error) {
      console.error(error)
      setDocError(error instanceof Error ? error.message : "Couldn't open the PDF.")
    } finally {
      setBusyItem(null)
    }
  }

  function addSigner(person: EsignProfile) {
    setSigners((current) => [
      ...current,
      {
        sub: person.sub,
        name: person.name,
        role: "",
        placement: defaultPlacement(current.length, pages),
        manual: false,
      },
    ])
    setSearch("")
  }

  function updateSigner(index: number, patch: Partial<SignerDraft>) {
    setSigners((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function moveSigner(index: number, by: -1 | 1) {
    setSigners((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })
  }

  function place(page: number, x: number, y: number) {
    if (placing === null) return
    const size = sizeOnPage(pages[page], BOX_PT.width, BOX_PT.height)
    updateSigner(placing, {
      placement: {
        page,
        width: size.width,
        height: size.height,
        x: Math.min(Math.max(x - size.width / 2, 0), 1 - size.width),
        y: Math.min(Math.max(y - size.height / 2, 0), 1 - size.height),
      },
      manual: true,
    })
    setPlacing(null)
  }

  const available = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return people
      .filter((p) => !signers.some((s) => s.sub === p.sub))
      .filter((p) => needle === "" || `${p.name} ${p.email ?? ""}`.toLocaleLowerCase().includes(needle))
  }, [people, signers, search])

  const recipients = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)
  const badEmail = recipients.find((e) => !EMAIL.test(e))
  const problems = [
    !staged && "Choose the document.",
    signers.length === 0 && "Add at least one signer.",
    title.trim() === "" && "Give the request a title.",
    saveToDrive && !folder && "Choose the OneDrive folder.",
    saveToDrive && fileName.trim() === "" && "Name the signed file.",
    badEmail && `“${badEmail}” isn't an email address.`,
  ].filter((p): p is string => Boolean(p))

  async function submit() {
    setAttempted(true)
    if (problems.length > 0 || !staged) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const request = await createFn({
        data: {
          title: title.trim(),
          documentId: staged.id,
          ordered,
          signers: signers.map((s) => ({ sub: s.sub, role: s.role.trim() || null, placement: s.placement })),
          output: saveToDrive && folder ? { folderId: folder.id, fileName: fileName.trim() } : null,
          email: recipients.length ? { to: recipients, message: message.trim() || null } : null,
        },
      })
      appToast.success("Request created.")
      await navigate({ to: "/dashboard/esign/requests/$requestId", params: { requestId: request.id } })
    } catch (error) {
      console.error(error)
      setSubmitError(error instanceof Error ? error.message : "Couldn't create the request.")
      setSubmitting(false)
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void upload(file)
  }

  return (
    <>
      <PageBar
        width="record"
        back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }}
        context="New request"
        right={
          <LoadingButton className="h-10" pending={submitting} onClick={submit}>
            Create request
          </LoadingButton>
        }
      />
      <PageContent width="record">
        <div className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {staged ? (
              <div className="flex flex-col gap-2">
                {placing !== null && (
                  <InlineAlert tone="info">
                    Click on the page where {signers[placing]?.name} signs.{" "}
                    <button type="button" className="text-(--pn-accent) underline" onClick={() => setPlacing(null)}>
                      Cancel
                    </button>
                  </InlineAlert>
                )}
                <PdfViewer
                  data={bytes}
                  pages={pages}
                  cursor={placing !== null ? "crosshair" : "default"}
                  onPageClick={place}
                  focus={
                    signers.at(-1)
                      ? { page: signers[signers.length - 1].placement.page, y: signers[signers.length - 1].placement.y }
                      : null
                  }
                  className="h-[calc(100dvh-210px)] min-h-[480px]"
                  overlay={(page) =>
                    signers.map((s, index) =>
                      s.placement.page === page ? (
                        <SignatureBox
                          key={s.sub}
                          placement={s.placement}
                          label={s.name}
                          role={s.role || null}
                          number={index + 1}
                          state="active"
                          editable
                          onChange={(placement) => updateSigner(index, { placement, manual: true })}
                        />
                      ) : null
                    )
                  }
                />
              </div>
            ) : (
              <section
                aria-label="Choose the document"
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex h-[calc(100dvh-210px)] min-h-[480px] flex-col gap-3 rounded-(--pn-r-5) border bg-(--pn-surface) p-4",
                  dragging ? "border-(--pn-accent) bg-(--pn-accent-soft)" : "border-(--pn-line)"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[17px] font-semibold">Choose the document</h2>
                  {config.drive && (
                    <div className="flex gap-1">
                      <Button
                        variant={source === "drive" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setSource("drive")}
                      >
                        <Cloud aria-hidden /> {config.drive}
                      </Button>
                      <Button
                        variant={source === "upload" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setSource("upload")}
                      >
                        <FileUp aria-hidden /> Upload
                      </Button>
                    </div>
                  )}
                </div>
                {docError && <InlineAlert>{docError}</InlineAlert>}
                {source === "drive" && config.drive ? (
                  <DriveBrowser
                    mode="file"
                    label={`Files in ${config.drive}`}
                    busyId={busyItem}
                    onPickFile={(item, from) => void importFromDrive(item.id, from)}
                    className="flex-1"
                  />
                ) : (
                  <label
                    htmlFor={ids.file}
                    className="grid flex-1 cursor-pointer place-items-center rounded-(--pn-r-4) border border-dashed border-(--pn-line-strong) p-6 text-center hover:bg-(--pn-hover)"
                  >
                    <span className="flex flex-col items-center gap-2">
                      <FileUp aria-hidden className="size-8 text-(--pn-fg-muted)" />
                      <span className="text-[15px] font-semibold">
                        {uploading ? "Uploading…" : "Drop a PDF here or choose one"}
                      </span>
                      <span className="text-[13px] text-(--pn-fg-muted)">
                        Up to 30 MB. Encrypted PDFs can't be signed.
                      </span>
                    </span>
                    <input
                      id={ids.file}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void upload(file)
                        event.target.value = ""
                      }}
                    />
                  </label>
                )}
              </section>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {attempted && problems.length > 0 && <InlineAlert>{problems[0]}</InlineAlert>}
            {submitError && <InlineAlert>{submitError}</InlineAlert>}
            {staged && (
              <SectionCard
                title="Document"
                action={
                  <Button variant="ghost" size="sm" onClick={() => setStaged(null)}>
                    Change
                  </Button>
                }
              >
                <p className="truncate text-[14px] font-medium">{staged.fileName}</p>
                <p className="text-[13px] text-(--pn-fg-muted)">
                  {pluralize(staged.pdf.pages.length, "page")}
                  {staged.pdf.signatures.length > 0 &&
                    ` · already signed by ${staged.pdf.signatures.map((s) => s.signerName).join(", ")}`}
                </p>
              </SectionCard>
            )}

            <SectionCard title="Signers" count={signers.length || undefined}>
              {signers.length > 0 && (
                <ol className="mb-3 flex flex-col gap-3">
                  {signers.map((s, index) => (
                    <li key={s.sub} className="flex flex-col gap-2 rounded-(--pn-r-4) border border-(--pn-line) p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--pn-accent-soft) text-[12px] font-semibold text-(--pn-accent) tabular-nums">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                          {s.name}
                          {s.sub === me && <span className="font-normal text-(--pn-fg-muted)"> (you)</span>}
                        </span>
                        <IconButton
                          label="Move up"
                          icon={ArrowUp}
                          disabled={index === 0}
                          onClick={() => moveSigner(index, -1)}
                        />
                        <IconButton
                          label="Move down"
                          icon={ArrowDown}
                          disabled={index === signers.length - 1}
                          onClick={() => moveSigner(index, 1)}
                        />
                        <IconButton
                          label={`Remove ${s.name}`}
                          icon={Trash2}
                          tone="danger"
                          onClick={() => setSigners((current) => current.filter((_, i) => i !== index))}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={`Role of ${s.name}`}
                          placeholder="Role (optional), e.g. Segretario"
                          list={ids.roles}
                          value={s.role}
                          maxLength={80}
                          className={cn(fieldControl, "h-9 flex-1")}
                          onChange={(event) => {
                            const role = event.target.value
                            const placed = s.manual ? null : placementForRole(role, anchors, pages)
                            updateSigner(index, placed ? { role, placement: placed } : { role })
                          }}
                        />
                        <Button
                          variant={placing === index ? "secondary" : "outline"}
                          size="sm"
                          disabled={!staged}
                          onClick={() => setPlacing(placing === index ? null : index)}
                        >
                          <MapPin aria-hidden /> Place
                        </Button>
                      </div>
                      <p className="text-[12px] text-(--pn-fg-muted) tabular-nums">Page {s.placement.page + 1}</p>
                    </li>
                  ))}
                </ol>
              )}
              <datalist id={ids.roles}>
                {ROLES.map((role) => (
                  <option key={role} value={role} />
                ))}
              </datalist>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
                  />
                  <Input
                    id={ids.search}
                    aria-label="Find a person to add"
                    placeholder="Add a signer…"
                    value={search}
                    className={cn(fieldControl, "pl-9")}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <ul className="flex max-h-48 flex-col overflow-y-auto">
                  {available.slice(0, 30).map((person) => (
                    <li key={person.sub}>
                      <button
                        type="button"
                        onClick={() => addSigner(person)}
                        className="flex h-10 w-full items-center gap-2 rounded-(--pn-r-2) px-2 text-left text-[14px] hover:bg-(--pn-hover)"
                      >
                        <UserPlus aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
                        <span className="min-w-0 flex-1 truncate">{person.name}</span>
                        {person.email && (
                          <span className="truncate font-mono text-[12px] text-(--pn-fg-muted)">{person.email}</span>
                        )}
                      </button>
                    </li>
                  ))}
                  {available.length === 0 && (
                    <li className="px-2 py-2 text-[13px] text-(--pn-fg-muted)">
                      {people.length <= signers.length
                        ? "Everyone who can sign is added. People appear here after they open Signatures once."
                        : "Nobody matches."}
                    </li>
                  )}
                </ul>
              </div>
              {signers.length > 1 && (
                <label className="mt-3 flex items-start gap-2 text-[14px]">
                  <Checkbox
                    className={checkboxControl}
                    checked={ordered}
                    onCheckedChange={(v) => setOrdered(Boolean(v))}
                  />
                  <span>
                    Sign in this order
                    <span className="block text-[12px] text-(--pn-fg-muted)">
                      Each signer is asked after the previous one signs.
                    </span>
                  </span>
                </label>
              )}
            </SectionCard>

            <SectionCard title="Details">
              <div className="flex flex-col gap-4">
                <FormField label="Title" htmlFor={ids.title}>
                  <Input
                    id={ids.title}
                    className={fieldControl}
                    value={title}
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </FormField>
                {config.drive && (
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[14px] font-medium">
                      <Checkbox
                        className={checkboxControl}
                        checked={saveToDrive}
                        onCheckedChange={(v) => setSaveToDrive(Boolean(v))}
                      />
                      Save the signed PDF to {config.drive}
                    </label>
                    {saveToDrive && (
                      <>
                        <div className="flex items-center justify-between gap-2 rounded-(--pn-r-3) bg-(--pn-sunken) px-3 py-2">
                          <span className="min-w-0 truncate font-mono text-[12px]">
                            {folder ? `/${folder.path}` : "No folder chosen"}
                          </span>
                          <Button variant="outline" size="sm" onClick={() => setChoosingFolder((v) => !v)}>
                            {choosingFolder ? "Close" : "Choose folder"}
                          </Button>
                        </div>
                        {choosingFolder && (
                          <DriveBrowser
                            mode="folder"
                            label={`Folders in ${config.drive}`}
                            className="h-72"
                            onPickFolder={(picked) => {
                              setFolder(picked)
                              setChoosingFolder(false)
                            }}
                          />
                        )}
                        <FormField label="File name" htmlFor={`${ids.title}-file`}>
                          <Input
                            id={`${ids.title}-file`}
                            className={fieldControl}
                            value={fileName}
                            maxLength={200}
                            onChange={(e) => setFileName(e.target.value)}
                          />
                        </FormField>
                      </>
                    )}
                  </div>
                )}
                <FormField
                  label="Email the signed PDF to"
                  htmlFor={ids.emails}
                  optional
                  hint="Addresses separated by commas. Sent when every signature is in."
                >
                  <Input
                    id={ids.emails}
                    className={fieldControl}
                    value={emails}
                    inputMode="email"
                    placeholder="segreteria@polinetwork.org"
                    onChange={(e) => setEmails(e.target.value)}
                  />
                </FormField>
                {recipients.length > 0 && (
                  <FormField label="Message" htmlFor={ids.message} optional>
                    <Textarea
                      id={ids.message}
                      className={fieldControl}
                      value={message}
                      maxLength={2000}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </FormField>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </PageContent>
    </>
  )
}
