import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  Cloud,
  FileUp,
  MapPin,
  PenLine,
  Plus,
  Search,
  Stamp,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react"
import { type DragEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react"

import {
  Autocomplete,
  checkboxControl,
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  FormField,
  fieldControl,
  fieldHintId,
  IconButton,
  InlineAlert,
  LoadingButton,
  SectionCard,
  useFocusAfterRemoval,
} from "@/components/primitives"
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/primitives/menu"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { EsignConfig, EsignPdfInfo, EsignProfile } from "@/lib/api/types"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { DriveBrowser, type DriveFolder } from "./drive-browser"
import { getEsignDocumentContent } from "./esign.functions"
import { extractTextAnchors, type PageSize, PdfViewer, sizeOnPage, type TextAnchor, usePdfBytes } from "./pdf-viewer"
import { kindsLabel, type Place, pagesLabel, withSignature } from "./places"
import { YouChip } from "./request-status"
import { createEsignRequest, importEsignDriveDocument, uploadEsignDocument } from "./requests.functions"
import { SignWithCie } from "./sign-with-cie"
import { type BoxPlacement, SignatureBox } from "./signature-box"
import { useFillHeight } from "./use-fill-height"

type Staged = { id: string; fileName: string; pdf: EsignPdfInfo; folder: DriveFolder | null }
/** `byRole`: the box the signer's role places under its label, until the user moves it. */
type DraftPlace = Place & { byRole?: true }
type SignerDraft = { sub: string; name: string; role: string; places: DraftPlace[] }
/** Where the next click on a page puts a box: a signer's existing place, or a new one when `place` is null. */
type Placing = { signer: number; place: number | null }

/** Boxes one signer may have in a document (the backend's limit). */
const MAX_PLACES = 20

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

/**
 * Moves the signer's role box under the label naming their role. The same signer when there is nothing to move: no
 * role box, a role the document doesn't name (the box stays where it is), or a box already there.
 */
function placeByRole(signer: SignerDraft, anchors: TextAnchor[], pages: PageSize[]): SignerDraft {
  const at = signer.places.findIndex((p) => p.byRole)
  const box = signer.places[at]
  const placed = box ? placementForRole(signer.role, anchors, pages) : null
  if (!box || !placed) return signer
  const keys = ["page", "x", "y", "width", "height"] as const
  if (keys.every((key) => placed[key] === box[key])) return signer
  return { ...signer, places: signer.places.map((p, i) => (i === at ? { ...placed, kind: p.kind, byRole: true } : p)) }
}

function draftOf(person: EsignProfile, index: number, pages: PageSize[]): SignerDraft {
  const where = defaultPlacement(index, pages)
  return { sub: person.sub, name: person.name, role: "", places: [{ ...where, kind: "signature", byRole: true }] }
}

export function NewEsignRequestPage({
  config,
  signers: people,
  me,
  withMe,
}: {
  config: EsignConfig
  signers: EsignProfile[]
  me: string
  /** Start with the viewer as the first signer ("Sign a document"). */
  withMe: boolean
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const uploadFn = useServerFn(uploadEsignDocument)
  const importFn = useServerFn(importEsignDriveDocument)
  const contentFn = useServerFn(getEsignDocumentContent)
  const createFn = useServerFn(createEsignRequest)
  const dropFill = useFillHeight<HTMLElement>()
  const ids = {
    title: useId(),
    file: useId(),
    fileName: useId(),
    folderError: useId(),
    emails: useId(),
    message: useId(),
    search: useId(),
    signersError: useId(),
  }

  const [source, setSource] = useState<"drive" | "upload">(config.drives.length > 0 ? "drive" : "upload")
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

  const [signers, setSigners] = useState<SignerDraft[]>(() => {
    const self = withMe ? people.find((p) => p.sub === me) : undefined
    return self ? [draftOf(self, 0, [])] : []
  })
  const [placing, setPlacing] = useState<Placing | null>(null)
  const [focus, setFocus] = useState<{ page: number; y: number } | null>(null)
  /** The box whose menu is open, so it stands out among the same person's boxes. */
  const [highlight, setHighlight] = useState<{ signer: string; place: number } | null>(null)
  const [ordered, setOrdered] = useState(true)
  const [search, setSearch] = useState("")

  const [title, setTitle] = useState("")
  const [titleTouched, setTitleTouched] = useState(false)
  const [saveToDrive, setSaveToDrive] = useState(config.drives.length > 0)
  const [folder, setFolder] = useState<DriveFolder | null>(null)
  const [choosingFolder, setChoosingFolder] = useState(false)
  const [fileName, setFileName] = useState("")
  const [fileNameTouched, setFileNameTouched] = useState(false)
  const [folderTouched, setFolderTouched] = useState(false)
  const [emails, setEmails] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdRequest, setCreatedRequest] = useState<string | null>(null)
  /** A submit was blocked: problems fixed with a click (document, signers, folder) show from then on. */
  const [attempted, setAttempted] = useState(false)
  /** Text-field errors on screen: set by a blocked submit, then re-checked when the field loses focus. */
  const [shown, setShown] = useState<{ title?: string; fileName?: string; email?: string }>({})
  /** Each blocked submit focuses the first problem once its message has rendered. */
  const [blockedSubmits, setBlockedSubmits] = useState(0)
  const form = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (blockedSubmits > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]')?.focus()
  }, [blockedSubmits])
  const submitAlert = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (submitError) submitAlert.current?.scrollIntoView({ block: "nearest" })
  }, [submitError])

  const pages = staged?.pdf.pages ?? []
  // One drive goes by its own name; several are browsed together under "OneDrive".
  const drivesName = config.drives.length === 1 ? config.drives[0].label : "OneDrive"
  const driveLabel = (id: string) => config.drives.find((d) => d.id === id)?.label ?? "OneDrive"

  // The labels of the document on screen place the role boxes, including roles typed before they were read.
  useEffect(() => {
    if (!staged || anchors.length === 0) return
    setSigners((current) => {
      const next = current.map((s) => placeByRole(s, anchors, staged.pdf.pages))
      return next.some((s, i) => s !== current[i]) ? next : current
    })
  }, [anchors, staged])

  function adopt(next: Staged, content: string) {
    setStaged(next)
    setBase64(content)
    // The same PDF picked again keeps its labels: its bytes aren't read again.
    if (content !== base64) setAnchors([])
    const name = baseName(next.fileName)
    if (!titleTouched || title.trim() === "") setTitle(name)
    if (!fileNameTouched || fileName.trim() === "") setFileName(`${name} - firmato.pdf`)
    if (next.folder && (!folderTouched || !folder)) setFolder(next.folder)
    setShown(({ email }) => ({ email }))
    setSigners((current) =>
      current.map((s, i) => ({
        ...s,
        places: [{ ...defaultPlacement(i, next.pdf.pages), kind: "signature", byRole: true }],
      }))
    )
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

  async function importFromDrive(itemId: string, from: DriveFolder) {
    setDocError(null)
    setBusyItem(itemId)
    try {
      const result = await importFn({ data: { driveId: from.driveId, itemId } })
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

  const signerList = useFocusAfterRemoval<HTMLOListElement>("[data-signer-row]")
  const searchRef = useRef<HTMLInputElement>(null)
  const roleInputs = useRef(new Map<string, HTMLInputElement>())
  /** The signer just added, whose role takes the focus once their row renders. */
  const focusRole = useRef<string | null>(null)
  useEffect(() => {
    if (focusRole.current === null) return
    roleInputs.current.get(focusRole.current)?.focus()
    focusRole.current = null
  }, [signers])

  function addSigner(person: EsignProfile) {
    const draft = draftOf(person, signers.length, pages)
    setSigners((current) => [...current, draft])
    setFocus({ page: draft.places[0].page, y: draft.places[0].y })
    setSearch("")
    focusRole.current = person.sub
  }

  function removeSigner(index: number, button: HTMLElement) {
    if (signers.length === 1) searchRef.current?.focus()
    else signerList.capture(button, { restore: true })
    setSigners((current) => current.filter((_, i) => i !== index))
  }

  function moveSigner(index: number, by: -1 | 1) {
    setSigners((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })
  }

  function setRole(index: number, role: string) {
    const s = signers[index]
    const next = placeByRole({ ...s, role }, anchors, pages)
    const placed = next.places.find((p) => p.byRole)
    if (next.places !== s.places && placed) setFocus({ page: placed.page, y: placed.y })
    setSigners((current) => current.map((c, i) => (i === index ? next : c)))
  }

  function updatePlaces(index: number, update: (places: DraftPlace[]) => DraftPlace[]) {
    setSigners((current) =>
      current.map((s, i) => (i === index ? { ...s, places: withSignature(update(s.places)) } : s))
    )
  }

  // The box comes back with every field it was given: rebuilt without `byRole`, it no longer follows the role.
  function movePlace(index: number, at: number, { page, x, y, width, height }: BoxPlacement) {
    updatePlaces(index, (places) => places.map((p, i) => (i === at ? { page, x, y, width, height, kind: p.kind } : p)))
  }

  function removePlace(index: number, at: number) {
    updatePlaces(index, (places) => places.filter((_, i) => i !== at))
  }

  function place(page: number, x: number, y: number) {
    if (placing === null) return
    const size = sizeOnPage(pages[page], BOX_PT.width, BOX_PT.height)
    const placement = {
      page,
      width: size.width,
      height: size.height,
      x: Math.min(Math.max(x - size.width / 2, 0), 1 - size.width),
      y: Math.min(Math.max(y - size.height / 2, 0), 1 - size.height),
    }
    const at = placing.place
    // Clicked places keep reading order (page, then top to bottom), which is also the order they are signed in.
    updatePlaces(placing.signer, (places) =>
      (at === null
        ? [...places, { ...placement, kind: "signature" as const }]
        : places.map((p, i) => (i === at ? { ...placement, kind: p.kind } : p))
      ).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    )
    setPlacing(null)
  }

  // The drives the request uses decide who may sign it: where the PDF came from, and where it is saved.
  const usedDrives = [
    ...new Set([staged?.folder?.driveId, saveToDrive ? folder?.driveId : undefined].filter((d) => d !== undefined)),
  ]
  const blockedDrive = (sub: string) => {
    const person = people.find((p) => p.sub === sub)
    return usedDrives.find((d) => !person?.drives.includes(d))
  }
  const available = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return people
      .filter((p) => !signers.some((s) => s.sub === p.sub))
      .filter((p) => usedDrives.every((d) => p.drives.includes(d)))
      .filter((p) => needle === "" || `${p.name} ${p.email ?? ""}`.toLocaleLowerCase().includes(needle))
      .sort((a, b) => Number(b.sub === me) - Number(a.sub === me))
  }, [people, signers, search, me, usedDrives.join()])
  // The picker lists people only once something is typed, so the whole directory is never shown at once.
  const matches = search.trim() === "" ? [] : available
  const outsiders = signers.filter((s) => blockedDrive(s.sub) !== undefined)
  const eligible = people.filter((p) => usedDrives.every((d) => p.drives.includes(d)))

  const recipients = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)
  const badEmail = recipients.find((e) => !EMAIL.test(e))
  const errors = {
    document: staged ? undefined : "Choose the document.",
    signers: signers.length > 0 ? undefined : "Add at least one signer.",
    title: title.trim() === "" ? "Give the request a title." : undefined,
    folder: saveToDrive && !folder ? "Choose the OneDrive folder." : undefined,
    fileName: saveToDrive && fileName.trim() === "" ? "Name the signed file." : undefined,
    email: badEmail ? `“${badEmail}” isn't an email address.` : undefined,
  }
  // Signers who may not sign these documents block the request too; their rows say why.
  const problems = outsiders.length > 0 || Object.values(errors).some(Boolean)

  function revalidate(field: keyof typeof shown) {
    if (shown[field]) setShown((current) => ({ ...current, [field]: errors[field] }))
  }

  function showProblems() {
    setAttempted(true)
    setShown({ title: errors.title, fileName: errors.fileName, email: errors.email })
    setBlockedSubmits((count) => count + 1)
  }

  // When the viewer signs first, creating the request and signing it are one step.
  const myIndex = signers.findIndex((s) => s.sub === me)
  const signsFirst = myIndex === 0 || (myIndex > 0 && !ordered)
  const onlyMe = signsFirst && signers.length === 1

  /** Creates the request once: a signature that doesn't start leaves it on its page, ready to sign again. */
  const created = useRef<{ id: string; title: string } | null>(null)

  const creating = useRef(false)

  async function create(documentId: string) {
    if (created.current) return created.current
    if (creating.current) return null
    creating.current = true
    setSubmitError(null)
    let request: Awaited<ReturnType<typeof createFn>>
    try {
      request = await createFn({
        data: {
          title: title.trim(),
          documentId,
          ordered,
          signers: signers.map((s) => ({
            sub: s.sub,
            role: s.role.trim() || null,
            places: s.places.map(({ page, x, y, width, height, kind }) => ({ page, x, y, width, height, kind })),
          })),
          output:
            saveToDrive && folder ? { driveId: folder.driveId, folderId: folder.id, fileName: fileName.trim() } : null,
          email: recipients.length ? { to: recipients, message: message.trim() || null } : null,
        },
      })
    } catch (error) {
      console.error(error)
      setSubmitError(error instanceof Error ? error.message : "Couldn't create the request.")
      return null
    } finally {
      creating.current = false
    }
    created.current = { id: request.id, title: request.title }
    setCreatedRequest(request.id)
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    return created.current
  }

  async function openRequest(id: string) {
    try {
      await navigate({ to: "/dashboard/esign/requests/$requestId", params: { requestId: id } })
    } catch (error) {
      console.error(error)
    }
  }

  async function submit() {
    if (submitting || created.current) return
    if (problems || !staged) return showProblems()
    setSubmitting(true)
    const request = await create(staged.id)
    if (!request) return setSubmitting(false)
    await openRequest(request.id)
    setSubmitting(false)
    appToast.success("Request created.")
  }

  function createAndSign() {
    if (submitting || created.current) return null
    if (problems || !staged) {
      showProblems()
      return null
    }
    return create(staged.id).then((request) => (request ? [{ requestId: request.id, title: request.title }] : []))
  }

  async function signingStopped(error: string | null) {
    const request = created.current
    if (!request) return
    await openRequest(request.id)
    if (error) appToast.error(`Request created, but the signature couldn't start. ${error}`)
    else appToast.success("Request created. Sign it here when you're ready.")
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
        context={onlyMe ? "Sign a document" : "New request"}
        right={
          signsFirst ? (
            <SignWithCie
              prepare={createAndSign}
              disabled={submitting || createdRequest !== null}
              onSigned={() => created.current && void openRequest(created.current.id)}
              onStopped={signingStopped}
            >
              {onlyMe ? "Sign with CIE" : "Create and sign"}
            </SignWithCie>
          ) : (
            <LoadingButton className="h-10" pending={submitting} disabled={createdRequest !== null} onClick={submit}>
              Create request
            </LoadingButton>
          )
        }
      />
      <PageContent width="record">
        <div ref={form} className="grid gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {staged ? (
              <div className="flex flex-col gap-2">
                {placing !== null && (
                  <InlineAlert tone="info">
                    {placing.place === null
                      ? `Click where ${signers[placing.signer]?.name} signs again.`
                      : `Click the new spot for ${signers[placing.signer]?.name}.`}{" "}
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
                  focus={focus}
                  overlay={(page) =>
                    signers.flatMap((s, index) =>
                      s.places.map((p, at) =>
                        p.page === page ? (
                          <SignatureBox
                            // biome-ignore lint/suspicious/noArrayIndexKey: places have no identity but their order
                            key={`${s.sub}-${at}`}
                            placement={p}
                            label={s.name}
                            role={s.role || null}
                            number={index + 1}
                            kind={p.kind}
                            state="active"
                            editable
                            highlighted={highlight?.signer === s.sub && highlight.place === at}
                            onChange={(placement) => movePlace(index, at, placement)}
                            onRemove={s.places.length > 1 ? () => removePlace(index, at) : undefined}
                          />
                        ) : null
                      )
                    )
                  }
                />
              </div>
            ) : (
              <section
                aria-label="Choose the document"
                tabIndex={-1}
                data-invalid={attempted || undefined}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                ref={dropFill.ref}
                style={dropFill.style}
                className={cn(
                  "flex h-[calc(100dvh-210px)] min-h-[480px] flex-col gap-3 rounded-(--pn-r-5) border bg-(--pn-surface) p-4",
                  dragging ? "border-(--pn-accent) bg-(--pn-accent-soft)" : "border-(--pn-line)"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[17px] font-semibold">Choose the document</h2>
                  {config.drives.length > 0 && (
                    <div className="flex gap-1">
                      <Button
                        variant={source === "drive" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setSource("drive")}
                      >
                        <Cloud aria-hidden /> {drivesName}
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
                {(docError || attempted) && <InlineAlert>{docError ?? errors.document}</InlineAlert>}
                {source === "drive" && config.drives.length > 0 ? (
                  <DriveBrowser
                    mode="file"
                    label="Files"
                    drives={config.drives}
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
            {submitError && (
              <div ref={submitAlert}>
                <InlineAlert>{submitError}</InlineAlert>
              </div>
            )}
            {createdRequest && (
              <InlineAlert tone="info">
                Request created.{" "}
                <a className="text-(--pn-accent) underline" href={`/dashboard/esign/requests/${createdRequest}`}>
                  Open request
                </a>
              </InlineAlert>
            )}
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
                <ol ref={signerList.surfaceRef} tabIndex={-1} className="mb-3 flex flex-col gap-3">
                  {signers.map((s, index) => {
                    const blocked = blockedDrive(s.sub)
                    const blockedId = `${ids.signersError}-${index}`
                    return (
                      <li
                        key={s.sub}
                        data-signer-row
                        tabIndex={blocked === undefined ? undefined : -1}
                        aria-describedby={blocked === undefined ? undefined : blockedId}
                        data-invalid={(attempted && blocked !== undefined) || undefined}
                        className="flex flex-col gap-2 rounded-(--pn-r-4) border border-(--pn-line) p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-(--pn-accent-soft) text-[12px] font-semibold text-(--pn-accent) tabular-nums">
                            {index + 1}
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="truncate text-[14px] font-medium">{s.name}</span>
                            {s.sub === me && <YouChip />}
                          </span>
                          {signers.length > 1 && (
                            <>
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
                            </>
                          )}
                          <IconButton
                            label={`Remove ${s.name}`}
                            icon={Trash2}
                            tone="danger"
                            onClick={(event) => removeSigner(index, event.currentTarget)}
                          />
                        </div>
                        {/* No autoHighlight: Enter keeps a role typed by hand instead of taking the first suggestion. */}
                        <Autocomplete items={ROLES} value={s.role} onValueChange={(role) => setRole(index, role)}>
                          <ComboboxInput
                            ref={(input: HTMLInputElement | null) => {
                              if (input) roleInputs.current.set(s.sub, input)
                              else roleInputs.current.delete(s.sub)
                            }}
                            listLabel="roles"
                            aria-label={`Role of ${s.name}`}
                            placeholder="Role (optional), e.g. Segretario"
                            maxLength={80}
                          />
                          <ComboboxContent>
                            <ComboboxList>
                              {(role: string) => (
                                <ComboboxItem key={role} value={role}>
                                  {role}
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Autocomplete>
                        {blocked !== undefined &&
                          (attempted ? (
                            <FieldError id={blockedId}>Can't sign documents of {driveLabel(blocked)}</FieldError>
                          ) : (
                            <p id={blockedId} className="flex items-center gap-1.5 text-[12px] text-(--pn-warning-fg)">
                              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                              Can't sign documents of {driveLabel(blocked)}
                            </p>
                          ))}
                        <PlacesEditor
                          name={s.name}
                          places={s.places}
                          disabled={!staged}
                          adding={placing?.signer === index && placing.place === null}
                          onShow={(at) => {
                            setHighlight(at === null ? null : { signer: s.sub, place: at })
                            const p = at === null ? undefined : s.places[at]
                            if (p) setFocus({ page: p.page, y: p.y + p.height / 2 })
                          }}
                          onKind={(at, kind) =>
                            updatePlaces(index, (places) => places.map((p, i) => (i === at ? { ...p, kind } : p)))
                          }
                          onMove={(at) => setPlacing({ signer: index, place: at })}
                          onRemove={(at) => removePlace(index, at)}
                          onAdd={() =>
                            setPlacing(
                              placing?.signer === index && placing.place === null
                                ? null
                                : { signer: index, place: null }
                            )
                          }
                        />
                      </li>
                    )
                  })}
                </ol>
              )}
              {/* The page filters people itself and lists them only once something is typed; the list stays in place. */}
              <Combobox
                items={matches.slice(0, 30)}
                filter={null}
                itemToStringLabel={(person: EsignProfile) => person.name}
                value={null}
                inputValue={search}
                onInputValueChange={(value, { reason }) => {
                  // Picking a person would otherwise put their name in the search.
                  if (reason !== "item-press") setSearch(value)
                }}
                onValueChange={(person) => person && addSigner(person)}
                autoHighlight
                inline
                open
              >
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
                    />
                    <ComboboxPrimitive.Input
                      ref={searchRef}
                      render={<Input id={ids.search} className={cn(fieldControl, "pl-9")} />}
                      aria-label="Find a person to add"
                      placeholder="Add a signer…"
                      aria-invalid={(attempted && errors.signers !== undefined) || undefined}
                      aria-describedby={attempted && errors.signers ? ids.signersError : undefined}
                    />
                  </div>
                  {attempted && errors.signers && <FieldError id={ids.signersError}>{errors.signers}</FieldError>}
                  <ComboboxList className="p-0 empty:hidden">
                    {(person: EsignProfile) => (
                      <ComboboxItem key={person.sub} value={person} className="min-h-10 px-2 py-1.5">
                        <UserPlus aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[14px]">{person.name}</span>
                            {person.sub === me && <YouChip />}
                          </span>
                          {person.email && (
                            <span className="truncate font-mono text-[12px] text-(--pn-fg-muted)">{person.email}</span>
                          )}
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                  {available.length === 0 && (
                    <p className="px-2 py-2 text-[13px] text-(--pn-fg-muted)">
                      {search.trim() !== ""
                        ? "Nobody matches."
                        : eligible.length === 0 && usedDrives.length > 0
                          ? `Nobody can sign documents of ${usedDrives.map(driveLabel).join(" and ")}. Who can is set in Signatures › Drives.`
                          : eligible.length === 0
                            ? "No registered people currently have permission to sign."
                            : usedDrives.length > 0
                              ? "Everyone allowed to sign these documents is added."
                              : "Everyone who can sign is added."}
                    </p>
                  )}
                  {matches.length > 0 && eligible.length < people.length && (
                    <p className="px-2 text-[12px] text-pretty text-(--pn-fg-muted)">
                      Only people allowed to sign documents of {usedDrives.map(driveLabel).join(" and ")} are listed.
                    </p>
                  )}
                </div>
              </Combobox>
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
                      {signsFirst && ordered
                        ? "You sign first, as soon as the request is created; each next signer is asked after the previous one signs."
                        : "Each signer is asked after the previous one signs."}
                    </span>
                  </span>
                </label>
              )}
            </SectionCard>

            <SectionCard title="Details">
              <div className="flex flex-col gap-4">
                <FormField label="Title" htmlFor={ids.title} error={shown.title}>
                  <Input
                    id={ids.title}
                    className={fieldControl}
                    value={title}
                    maxLength={200}
                    aria-invalid={shown.title ? true : undefined}
                    aria-describedby={shown.title ? fieldHintId(ids.title) : undefined}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      setTitleTouched(true)
                    }}
                    onBlur={() => revalidate("title")}
                  />
                </FormField>
                {config.drives.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[14px] font-medium">
                      <Checkbox
                        className={checkboxControl}
                        checked={saveToDrive}
                        onCheckedChange={(v) => setSaveToDrive(Boolean(v))}
                      />
                      Save the signed PDF to {drivesName}
                    </label>
                    {saveToDrive && (
                      <>
                        <div className="flex items-center justify-between gap-2 rounded-(--pn-r-3) bg-(--pn-sunken) px-3 py-2">
                          <span className="min-w-0 truncate font-mono text-[12px]">
                            {folder
                              ? `${config.drives.length > 1 ? `${driveLabel(folder.driveId)}: ` : ""}/${folder.path}`
                              : "No folder chosen"}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-invalid={(attempted && errors.folder !== undefined) || undefined}
                            aria-describedby={attempted && errors.folder ? ids.folderError : undefined}
                            onClick={() => setChoosingFolder((v) => !v)}
                          >
                            {choosingFolder ? "Close" : "Choose folder"}
                          </Button>
                        </div>
                        {attempted && errors.folder && <FieldError id={ids.folderError}>{errors.folder}</FieldError>}
                        {choosingFolder && (
                          <DriveBrowser
                            mode="folder"
                            label="Folders"
                            drives={config.drives}
                            initialDriveId={folder?.driveId}
                            className="h-72"
                            onPickFolder={(picked) => {
                              setFolder(picked)
                              setFolderTouched(true)
                              setChoosingFolder(false)
                            }}
                          />
                        )}
                        <FormField label="File name" htmlFor={ids.fileName} error={shown.fileName}>
                          <Input
                            id={ids.fileName}
                            className={fieldControl}
                            value={fileName}
                            maxLength={200}
                            aria-invalid={shown.fileName ? true : undefined}
                            aria-describedby={shown.fileName ? fieldHintId(ids.fileName) : undefined}
                            onChange={(e) => {
                              setFileName(e.target.value)
                              setFileNameTouched(true)
                            }}
                            onBlur={() => revalidate("fileName")}
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
                  error={shown.email}
                >
                  <Input
                    id={ids.emails}
                    className={fieldControl}
                    value={emails}
                    inputMode="email"
                    placeholder="segreteria@polinetwork.org"
                    aria-invalid={shown.email ? true : undefined}
                    aria-describedby={fieldHintId(ids.emails)}
                    onChange={(e) => setEmails(e.target.value)}
                    onBlur={() => revalidate("email")}
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

/** A problem shown at the control it is about, styled like `FormField`'s error. */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-(--pn-danger-fg)">
      <CircleAlert aria-hidden className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}

/** A signer's boxes, one control each, listed under their name: the person appears once however many places. */
function PlacesEditor({
  name,
  places,
  disabled,
  adding,
  onShow,
  onKind,
  onMove,
  onRemove,
  onAdd,
}: {
  name: string
  places: Place[]
  disabled: boolean
  adding: boolean
  /** A place's menu opened (its index) or closed (null). */
  onShow: (at: number | null) => void
  onKind: (at: number, kind: Place["kind"]) => void
  onMove: (at: number) => void
  onRemove: (at: number) => void
  onAdd: () => void
}) {
  const signatures = places.filter((p) => p.kind === "signature").length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {places.map((p, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: places have no identity but their order
          <Menu key={at} onOpenChange={(open) => onShow(open ? at : null)}>
            <MenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  aria-label={`${p.kind === "mark" ? "Mark" : "Signature"} of ${name} on page ${p.page + 1}`}
                  className="tabular-nums"
                />
              }
            >
              {p.kind === "mark" ? <Stamp aria-hidden /> : <PenLine aria-hidden />}
              {p.kind === "mark" ? "Mark" : "Signature"} · p. {p.page + 1}
              <ChevronDown aria-hidden className="text-(--pn-fg-muted)" />
            </MenuTrigger>
            <MenuContent align="start" className="w-60">
              <MenuGroup>
                <MenuLabel>Page {p.page + 1}</MenuLabel>
                <MenuRadioGroup
                  value={p.kind}
                  onValueChange={(value: string) => onKind(at, value === "mark" ? "mark" : "signature")}
                >
                  <MenuRadioItem value="signature">Full signature</MenuRadioItem>
                  <MenuRadioItem value="mark" disabled={p.kind === "signature" && signatures === 1}>
                    Mark only
                  </MenuRadioItem>
                </MenuRadioGroup>
                <p className="px-2 pt-0.5 pb-1.5 text-[12px] text-pretty text-(--pn-fg-muted)">
                  A mark shows the signature again without signing twice.
                </p>
              </MenuGroup>
              <MenuSeparator />
              <MenuItem onClick={() => onMove(at)}>
                <MapPin aria-hidden /> Move to another spot
              </MenuItem>
              <MenuItem variant="destructive" disabled={places.length === 1} onClick={() => onRemove(at)}>
                <Trash2 aria-hidden /> Remove
              </MenuItem>
            </MenuContent>
          </Menu>
        ))}
        <Button
          variant={adding ? "secondary" : "ghost"}
          size="sm"
          disabled={disabled || places.length >= MAX_PLACES}
          onClick={onAdd}
        >
          <Plus aria-hidden /> Add place
        </Button>
      </div>
      {places.length > 1 && (
        <p className="text-[12px] text-pretty text-(--pn-fg-muted)">
          {kindsLabel(places)} on {pagesLabel(places)}, signed with one PIN.
        </p>
      )}
    </div>
  )
}
