import { useBlocker, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  buttonMotion,
  checkboxControl,
  ConfirmDialog,
  FormDialog,
  fieldControl,
  InlineAlert,
  Kbd,
  LoadingButton,
  useFocusAfterRemoval,
  useModifierKey,
} from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import type { EsignConfig, EsignPdfInfo, EsignProfile } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { composerPrimary, invalidRecipient, parseRecipients, signsFirst as creatorSignsFirst } from "./composer"
import { FieldError, quietField } from "./composer-fields"
import { DeliveryRows, REVEAL_MS, type SaveView } from "./delivery-rows"
import { DocumentDialogBody, DocumentPanes, useFileDrop } from "./document-picker"
import type { DriveFolder } from "./drive-browser"
import { getEsignDocumentContent } from "./esign.functions"
import { extractTextAnchors, type PageSize, PdfViewer, sizeOnPage, type TextAnchor, usePdfBytes } from "./pdf-viewer"
import { withSignature } from "./places"
import { PlacingCancel } from "./placing"
import { createEsignRequest, importEsignDriveDocument, uploadEsignDocument } from "./requests.functions"
import { SignWithCie } from "./sign-with-cie"
import { type BoxPlacement, SignatureBox } from "./signature-box"
import { type DraftPlace, type SignerDraft, SignerPicker, SignerRow } from "./signer-rows"
import { useCanSignHere } from "./signing-device"
import { useFillHeight } from "./use-fill-height"

type Staged = { id: string; fileName: string; pdf: EsignPdfInfo; folder: DriveFolder | null }
/** Where the next click on a page puts a box: a signer's existing place, or a new one when `place` is null. */
type Placing = { signer: number; place: number | null }

/** A signature box of 190 × 62 pt, the size of a typical handwritten-signature space. */
const BOX_PT = { width: 190, height: 62 }
/** The folder the last PDF was picked from, `{ driveId, id }`, where the drive browser opens next time. */
const LAST_FOLDER_KEY = "pn-admin:esign-last-folder"
/** The title field grows to three lines, then scrolls. */
const TITLE_MAX_HEIGHT = 80

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

/**
 * New request: the document fills the left of the workspace, and one column on the right says who signs and where
 * the signed copy goes, with the primary action pinned at its foot. Before there is a document the same two places
 * offer the shared drives and a dropzone.
 */
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
  const router = useRouter()
  const uploadFn = useServerFn(uploadEsignDocument)
  const importFn = useServerFn(importEsignDriveDocument)
  const contentFn = useServerFn(getEsignDocumentContent)
  const createFn = useServerFn(createEsignRequest)
  const canSignHere = useCanSignHere()
  const modifier = useModifierKey()
  const workspace = useFillHeight<HTMLDivElement>()
  const ids = { titleError: useId(), signersError: useId() }
  const hasDrives = config.drives.length > 0

  const [staged, setStaged] = useState<Staged | null>(null)
  const [base64, setBase64] = useState<string | null>(null)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [docError, setDocError] = useState<{ from: "drive" | "upload"; message: string } | null>(null)
  const [changingPdf, setChangingPdf] = useState(false)
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
  const [placing, setPlacing] = useState<Placing | null>(null)
  const [focus, setFocus] = useState<{ page: number; y: number } | null>(null)
  /** The box whose menu is open, so it stands out among the same person's boxes. */
  const [highlight, setHighlight] = useState<{ signer: string; place: number } | null>(null)
  /** The signer whose row has the pointer or the focus: their boxes are ringed. */
  const [rowPointed, setRowPointed] = useState<string | null>(null)
  /** The signer whose box has the pointer: their row is tinted. */
  const [boxPointed, setBoxPointed] = useState<string | null>(null)
  const [ordered, setOrdered] = useState(true)

  const [title, setTitle] = useState("")
  const [titleTouched, setTitleTouched] = useState(false)
  const [saveToDrive, setSaveToDrive] = useState(hasDrives)
  const [folder, setFolder] = useState<DriveFolder | null>(null)
  const [saveView, setSaveView] = useState<SaveView>("closed")
  /** Undefined until local storage is read after mount, so the server and the first client render agree. */
  const [lastFolder, setLastFolder] = useState<Pick<DriveFolder, "driveId" | "id"> | null>()
  useEffect(() => {
    let stored: Pick<DriveFolder, "driveId" | "id"> | null = null
    try {
      stored = JSON.parse(window.localStorage.getItem(LAST_FOLDER_KEY) ?? "null")
    } catch (error) {
      console.error(error)
    }
    setLastFolder(stored)
  }, [])
  const [fileName, setFileName] = useState("")
  const [fileNameTouched, setFileNameTouched] = useState(false)
  const [folderTouched, setFolderTouched] = useState(false)
  const [emails, setEmails] = useState("")
  const [emailOpen, setEmailOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdRequest, setCreatedRequest] = useState<string | null>(null)
  /** A submit was blocked: problems fixed with a click (signers, folder) show from then on. */
  const [attempted, setAttempted] = useState(false)
  /** Text-field errors on screen: set by a blocked submit, then re-checked when the field loses focus. */
  const [shown, setShown] = useState<{ title?: string; fileName?: string; email?: string }>({})
  /** Each blocked submit focuses the first problem once its message has rendered. */
  const [blockedSubmits, setBlockedSubmits] = useState(0)
  /** The blocked submit opened a delivery row: the column scrolls to its problem once the row is open. */
  const problemsOpenRow = useRef(false)
  const column = useRef<HTMLElement>(null)
  useEffect(() => {
    if (blockedSubmits === 0) return
    const problem = column.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]')
    if (!problem) return
    // A folder to choose: its first folder takes the focus once listed, else the browser.
    const target = problem.matches("[data-folder-browser]")
      ? (problem.querySelector<HTMLElement>("li button") ?? problem)
      : problem
    target.focus({ preventScroll: true })
    const reveal = () => {
      problem.scrollIntoView({ block: "nearest" })
    }
    if (!problemsOpenRow.current) {
      reveal()
      return
    }
    const timer = window.setTimeout(reveal, REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [blockedSubmits])

  const pages = staged?.pdf.pages ?? []
  const driveLabel = (id: string) => config.drives.find((d) => d.id === id)?.label ?? "OneDrive"

  // The labels of the document on screen place the role boxes, including roles typed before they were read.
  useEffect(() => {
    if (!staged || anchors.length === 0) return
    setSigners((current) => {
      const next = current.map((s) => placeByRole(s, anchors, staged.pdf.pages))
      return next.some((s, i) => s !== current[i]) ? next : current
    })
  }, [anchors, staged])

  const pickerRef = useRef<HTMLInputElement>(null)
  /** The first document was just picked: the focus moves on to adding signers. */
  const focusPicker = useRef(false)
  useEffect(() => {
    if (!focusPicker.current || !staged) return
    focusPicker.current = false
    if (window.matchMedia("(pointer: fine)").matches) pickerRef.current?.focus()
  }, [staged])

  function adopt(next: Staged, content: string) {
    if (!staged) focusPicker.current = true
    setStaged(next)
    setBase64(content)
    setChangingPdf(false)
    // The same PDF picked again keeps its labels: its bytes aren't read again.
    if (content !== base64) setAnchors([])
    const name = baseName(next.fileName)
    if (!titleTouched || title.trim() === "") setTitle(name)
    if (!fileNameTouched || fileName.trim() === "") setFileName(`${name} - firmato.pdf`)
    const nextFolder = next.folder && (!folderTouched || !folder) ? next.folder : folder
    setFolder(nextFolder)
    // An uploaded PDF has no folder of its own: the question where to save it comes at once.
    setSaveView(hasDrives && saveToDrive && !nextFolder ? "browse" : "closed")
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
    if (!file.name.toLowerCase().endsWith(".pdf")) return setDocError({ from: "upload", message: "Choose a PDF file." })
    if (file.size > config.maxPdfBytes) return setDocError({ from: "upload", message: "The PDF is larger than 30 MB." })
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
      setDocError({ from: "upload", message: error instanceof Error ? error.message : "Couldn't upload the PDF." })
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
      const last = { driveId: from.driveId, id: from.id }
      window.localStorage.setItem(LAST_FOLDER_KEY, JSON.stringify(last))
      setLastFolder(last)
    } catch (error) {
      console.error(error)
      setDocError({ from: "drive", message: error instanceof Error ? error.message : "Couldn't open the PDF." })
    } finally {
      setBusyItem(null)
    }
  }

  const pageDrop = useFileDrop((file) => void upload(file))
  const dialogDrop = useFileDrop((file) => void upload(file))

  const signerList = useFocusAfterRemoval<HTMLOListElement>("[data-signer-row]")
  const roleInputs = useRef(new Map<string, HTMLInputElement>())
  /** The signer just added, whose role takes the focus once their row renders. */
  const focusRole = useRef<string | null>(null)
  /** The last signer was removed: the picker takes the focus. */
  const focusPickerAfterRemoval = useRef(false)
  useEffect(() => {
    if (focusRole.current !== null) {
      roleInputs.current.get(focusRole.current)?.focus()
      focusRole.current = null
    }
    if (focusPickerAfterRemoval.current) {
      focusPickerAfterRemoval.current = false
      pickerRef.current?.focus()
    }
  }, [signers])

  function addSigner(person: EsignProfile) {
    const draft = draftOf(person, signers.length, pages)
    const box = draft.places[0]
    setSigners((current) => [...current, draft])
    setFocus({ page: box.page, y: box.y + box.height / 2 })
    focusRole.current = person.sub
  }

  // Placing refers to a signer by position, so it ends when the positions change.
  function removeSigner(index: number, trigger: HTMLElement | null) {
    if (signers.length === 1) focusPickerAfterRemoval.current = true
    else if (trigger) signerList.capture(trigger, { restore: true })
    setSigners((current) => current.filter((_, i) => i !== index))
    setPlacing(null)
    setRowPointed(null)
  }

  function moveSigner(index: number, by: -1 | 1) {
    setPlacing(null)
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
    if (next.places !== s.places && placed) setFocus({ page: placed.page, y: placed.y + placed.height / 2 })
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
  const eligible = useMemo(
    () => people.filter((p) => usedDrives.every((d) => p.drives.includes(d))),
    [people, usedDrives.join()]
  )
  const available = useMemo(
    () =>
      eligible
        .filter((p) => !signers.some((s) => s.sub === p.sub))
        .sort((a, b) => Number(b.sub === me) - Number(a.sub === me)),
    [eligible, signers, me]
  )
  const meAddable = available.some((p) => p.sub === me)
  const outsiders = signers.filter((s) => blockedDrive(s.sub) !== undefined)

  function emptyText(query: string) {
    if (eligible.length === 0)
      return usedDrives.length > 0
        ? `Nobody can sign documents of ${usedDrives.map(driveLabel).join(" and ")}. Who can is set in Signatures › Drives.`
        : "No registered people currently have permission to sign."
    if (available.length === 0)
      return usedDrives.length > 0
        ? "Everyone allowed to sign these documents is added."
        : "Everyone who can sign is added."
    return query === "" ? null : "Nobody matches."
  }

  const recipients = parseRecipients(emails)
  const badEmail = invalidRecipient(recipients)
  const errors = {
    signers: signers.length > 0 ? undefined : "Add at least one signer.",
    title: title.trim() === "" ? "Give the request a title." : undefined,
    folder: saveToDrive && !folder ? "Choose a folder." : undefined,
    fileName: saveToDrive && folder && fileName.trim() === "" ? "Name the signed file." : undefined,
    email: badEmail ? `“${badEmail}” isn't an email address.` : undefined,
  }
  // Signers who may not sign these documents block the request too; their rows say why.
  const problems = outsiders.length > 0 || Object.values(errors).some(Boolean)

  function revalidate(field: keyof typeof shown) {
    if (shown[field]) setShown((current) => ({ ...current, [field]: errors[field] }))
  }

  /** Every problem shows at its control; a delivery row with one opens by itself. */
  function showProblems() {
    setAttempted(true)
    setShown({ title: errors.title, fileName: errors.fileName, email: errors.email })
    const saveProblem = errors.folder ? "browse" : errors.fileName ? "fields" : null
    problemsOpenRow.current =
      (saveProblem !== null && saveView === "closed") || (errors.email !== undefined && !emailOpen)
    if (saveProblem) setSaveView(saveProblem)
    if (errors.email) setEmailOpen(true)
    setBlockedSubmits((count) => count + 1)
  }

  // A creator whose turn comes first signs in the same click that creates the request.
  const signerSubs = signers.map((s) => s.sub)
  const signsFirst = creatorSignsFirst(signerSubs, me, ordered)
  const primary = composerPrimary(signerSubs, me, ordered, canSignHere)
  const numbered = ordered && signers.length > 1

  /** Creates the request once: a signature that doesn't start leaves it on its page, ready to sign again. */
  const created = useRef<{ id: string; title: string } | null>(null)

  const creating = useRef(false)

  const untouched =
    staged === null && title.trim() === "" && emails.trim() === "" && message.trim() === "" && signers.length === 0
  const dirty = createdRequest === null && !untouched
  // Reads the ref when it runs, so moving to the request just created is never blocked.
  const leave = useBlocker({
    shouldBlockFn: () => dirty && created.current === null,
    enableBeforeUnload: () => dirty && created.current === null,
    withResolver: true,
  })

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
    // Someone else was emailed about their turn; the creator's own turn waits for a computer that can sign.
    appToast.success(signsFirst ? "Request created." : "Request sent.")
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

  // ⌘/Ctrl+Enter runs the primary from anywhere on the page. A key press counts as the user's gesture, so the agent
  // window still opens in the same turn.
  const primaryRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function run(event: globalThis.KeyboardEvent) {
      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.repeat || event.isComposing) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      const button = primaryRef.current?.querySelector<HTMLButtonElement>("button")
      if (!button || button.disabled) return
      event.preventDefault()
      // An open signer or role list closes first.
      const active = document.activeElement
      if (active instanceof HTMLElement && active.getAttribute("role") === "combobox") active.blur()
      button.click()
    }
    window.addEventListener("keydown", run)
    return () => window.removeEventListener("keydown", run)
  }, [])

  const shortcut = <Kbd onSolid>{modifier === "⌘" ? "⌘ ↵" : "Ctrl ↵"}</Kbd>
  const placingName = placing === null ? null : signers[placing.signer]?.name
  // The two panes share the measured height; stacked, they keep their own.
  const workspaceStyle: (CSSProperties & { "--workspace-h"?: string }) | undefined =
    workspace.height === null ? undefined : { "--workspace-h": `${workspace.height}px` }

  const documentPicker = {
    drives: config.drives,
    lastFolder,
    busyItem,
    uploading,
    onPickDriveFile: (itemId: string, from: DriveFolder) => void importFromDrive(itemId, from),
    onUpload: (file: File) => void upload(file),
  }
  const driveError = docError?.from === "drive" && <InlineAlert className="shrink-0">{docError.message}</InlineAlert>
  const uploadError = docError?.from === "upload" && <InlineAlert className="shrink-0">{docError.message}</InlineAlert>

  return (
    <>
      <PageBar
        width="record"
        back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }}
        context="New request"
      />
      <PageContent width="record" fill>
        <div
          ref={workspace.ref}
          style={workspaceStyle}
          className="@container/composer [--workspace-h:max(480px,calc(100dvh-112px))]"
          {...(staged ? {} : pageDrop.handlers)}
        >
          <section
            aria-label={staged ? undefined : "Choose the document"}
            className="flex flex-col gap-4 @min-[900px]/composer:grid @min-[900px]/composer:h-(--workspace-h) @min-[900px]/composer:grid-cols-[minmax(0,1fr)_380px] @min-[1040px]/composer:grid-cols-[minmax(0,1fr)_400px]"
          >
            {!staged ? (
              <DocumentPanes
                {...documentPicker}
                dragging={pageDrop.dragging}
                driveError={driveError}
                uploadError={uploadError}
              />
            ) : (
              <>
                <div className="h-[60dvh] min-h-0 min-w-0 @min-[900px]/composer:h-full">
                  <PdfViewer
                    fill={false}
                    data={bytes}
                    pages={pages}
                    status={
                      placing === null
                        ? null
                        : placing.place === null
                          ? `Click where ${placingName} signs again.`
                          : `Click the new spot for ${placingName}.`
                    }
                    statusAction={placing !== null && <PlacingCancel onCancel={() => setPlacing(null)} />}
                    toolbarStart={
                      <Button
                        variant="ghost"
                        size="sm"
                        className={buttonMotion}
                        onClick={() => {
                          setDocError(null)
                          setChangingPdf(true)
                        }}
                      >
                        Change PDF
                      </Button>
                    }
                    cursor={placing !== null ? "crosshair" : "default"}
                    onPageClick={place}
                    focus={focus}
                    focusOnlyIfAway
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
                              number={numbered ? index + 1 : undefined}
                              kind={p.kind}
                              state="active"
                              editable
                              highlighted={
                                (highlight?.signer === s.sub && highlight.place === at) || rowPointed === s.sub
                              }
                              onChange={(placement) => movePlace(index, at, placement)}
                              onRemove={s.places.length > 1 ? () => removePlace(index, at) : undefined}
                              onHover={(hovering) =>
                                setBoxPointed((current) => (hovering ? s.sub : current === s.sub ? null : current))
                              }
                            />
                          ) : null
                        )
                      )
                    }
                  />
                </div>

                <section
                  ref={column}
                  className="flex min-h-0 min-w-0 flex-col rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface) @min-[900px]/composer:h-full"
                >
                  <div data-composer-body className="min-h-0 flex-1 @min-[900px]/composer:overflow-y-auto">
                    <div className="flex flex-col gap-1 p-4">
                      <TitleField
                        value={title}
                        error={shown.title}
                        errorId={ids.titleError}
                        onChange={(value) => {
                          setTitle(value)
                          setTitleTouched(true)
                        }}
                        onBlur={() => revalidate("title")}
                      />
                      {shown.title && <FieldError id={ids.titleError}>{shown.title}</FieldError>}
                      {staged.pdf.signatures.length > 0 && (
                        <p className="text-[13px] text-(--pn-fg-muted)">
                          Already signed by {staged.pdf.signatures.map((s) => s.signerName).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col border-t border-(--pn-line) p-4">
                      <h2 className="sr-only">Signers</h2>
                      {signers.length > 0 && (
                        <ol ref={signerList.surfaceRef} tabIndex={-1} className="mb-2 flex flex-col gap-1">
                          {signers.map((s, index) => {
                            const blocked = blockedDrive(s.sub)
                            return (
                              <SignerRow
                                key={s.sub}
                                signer={s}
                                index={index}
                                count={signers.length}
                                numbered={numbered}
                                isMe={s.sub === me}
                                blockedBy={blocked === undefined ? undefined : driveLabel(blocked)}
                                attempted={attempted}
                                pointed={boxPointed === s.sub}
                                roleRef={(input: HTMLInputElement | null) => {
                                  if (input) roleInputs.current.set(s.sub, input)
                                  else roleInputs.current.delete(s.sub)
                                }}
                                onRole={(role) => setRole(index, role)}
                                onPoint={(inside) =>
                                  setRowPointed((current) => (inside ? s.sub : current === s.sub ? null : current))
                                }
                                onMove={(by) => moveSigner(index, by)}
                                onAddPlace={() => setPlacing({ signer: index, place: null })}
                                onMovePlace={(at) => setPlacing({ signer: index, place: at })}
                                onPlaceKind={(at, kind) =>
                                  updatePlaces(index, (places) => places.map((p, i) => (i === at ? { ...p, kind } : p)))
                                }
                                onRemovePlace={(at) => removePlace(index, at)}
                                onShowPlace={(at) => {
                                  setHighlight(at === null ? null : { signer: s.sub, place: at })
                                  const p = at === null ? undefined : s.places[at]
                                  if (p) setFocus({ page: p.page, y: p.y + p.height / 2 })
                                }}
                                onRemove={(trigger) => removeSigner(index, trigger)}
                              />
                            )
                          })}
                        </ol>
                      )}
                      <SignerPicker
                        people={available}
                        me={me}
                        meAddable={meAddable}
                        emptyText={emptyText}
                        inputRef={pickerRef}
                        error={attempted ? errors.signers : undefined}
                        errorId={ids.signersError}
                        onAdd={addSigner}
                        onAddMe={() => {
                          const self = available.find((p) => p.sub === me)
                          if (self) addSigner(self)
                        }}
                      />
                      {signers.length > 1 && (
                        <label className="mt-2 flex h-6 items-center gap-2 text-[14px]">
                          <Checkbox
                            className={cn(checkboxControl, "mt-0")}
                            checked={ordered}
                            onCheckedChange={(value) => setOrdered(Boolean(value))}
                          />
                          Sign in this order
                        </label>
                      )}
                    </div>

                    <div className="border-t border-(--pn-line) px-2 py-4">
                      <h2 className="sr-only">Delivery</h2>
                      <DeliveryRows
                        drives={config.drives}
                        driveLabel={driveLabel}
                        saveToDrive={saveToDrive}
                        folder={folder}
                        fileName={fileName}
                        saveView={saveView}
                        onSaveView={setSaveView}
                        onFolder={(picked) => {
                          setFolder(picked)
                          setFolderTouched(true)
                          setSaveToDrive(true)
                        }}
                        onDontSave={() => setSaveToDrive(false)}
                        onFileName={(name) => {
                          setFileName(name)
                          setFileNameTouched(true)
                        }}
                        onFileNameBlur={() => revalidate("fileName")}
                        folderError={attempted ? errors.folder : undefined}
                        fileNameError={shown.fileName}
                        emails={emails}
                        recipients={recipients}
                        onEmails={setEmails}
                        onEmailsBlur={() => revalidate("email")}
                        emailError={shown.email}
                        emailOpen={emailOpen}
                        onEmailOpen={setEmailOpen}
                        message={message}
                        onMessage={setMessage}
                      />
                    </div>
                  </div>

                  <div className="sticky bottom-0 flex shrink-0 flex-col gap-2 rounded-b-[11px] border-t border-(--pn-line) bg-(--pn-surface) px-4 py-3">
                    {submitError && <InlineAlert>{submitError}</InlineAlert>}
                    {createdRequest && (
                      <InlineAlert tone="info">
                        Request created.{" "}
                        <a
                          className="text-(--pn-accent) underline"
                          href={`/dashboard/esign/requests/${createdRequest}`}
                        >
                          Open request
                        </a>
                      </InlineAlert>
                    )}
                    <div ref={primaryRef} data-composer-primary className="flex flex-col items-end gap-2 self-end">
                      {primary === "send" ? (
                        <LoadingButton
                          className="h-10 gap-2"
                          pending={submitting}
                          disabled={createdRequest !== null}
                          aria-keyshortcuts="Meta+Enter Control+Enter"
                          onClick={submit}
                        >
                          Send request {shortcut}
                        </LoadingButton>
                      ) : (
                        <SignWithCie
                          className="gap-2"
                          aria-keyshortcuts="Meta+Enter Control+Enter"
                          prepare={createAndSign}
                          disabled={submitting || createdRequest !== null}
                          onSigned={() => created.current && void openRequest(created.current.id)}
                          onStopped={signingStopped}
                        >
                          {primary === "sign" ? "Sign with CIE" : "Sign and send"} {shortcut}
                        </SignWithCie>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </section>
        </div>
      </PageContent>
      <FormDialog
        open={changingPdf}
        onOpenChange={setChangingPdf}
        size={hasDrives ? "lg" : "md"}
        title="Change PDF"
        noun="document"
        dirty={false}
        onSubmit={() => undefined}
      >
        <div className="flex flex-col gap-3" {...dialogDrop.handlers}>
          <DocumentDialogBody
            {...documentPicker}
            dragging={dialogDrop.dragging}
            driveError={driveError}
            uploadError={uploadError}
          />
        </div>
      </FormDialog>
      <ConfirmDialog
        open={leave.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) leave.reset?.()
        }}
        title="Discard changes?"
        description="The document, signers and boxes you set up here will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={async () => leave.proceed?.()}
      />
    </>
  )
}

/**
 * The request's title as a quiet field: edited in place with no click, one to three lines. Enter commits, pasted line
 * breaks become spaces, and Esc restores the title it had when it got the focus.
 */
function TitleField({
  value,
  error,
  errorId,
  onChange,
  onBlur,
}: {
  value: string
  error?: string
  errorId: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const atFocus = useRef(value)
  // Browsers without `field-sizing` size the field to its text here.
  useLayoutEffect(() => {
    const field = ref.current
    if (!field || CSS.supports("field-sizing", "content")) return
    field.style.height = "auto"
    field.style.height = `${Math.min(field.scrollHeight + 2, TITLE_MAX_HEIGHT)}px`
  }, [value])

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      if (!event.metaKey && !event.ctrlKey) event.currentTarget.blur()
    } else if (event.key === "Escape" && event.currentTarget.value !== atFocus.current) {
      event.preventDefault()
      onChange(atFocus.current)
    }
  }

  return (
    <Textarea
      ref={ref}
      aria-label="Title"
      rows={1}
      maxLength={200}
      value={value}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      onFocus={(event) => {
        atFocus.current = event.currentTarget.value
      }}
      onKeyDown={onKeyDown}
      onChange={(event) => onChange(event.target.value.replace(/\s*[\r\n]+\s*/g, " "))}
      onBlur={onBlur}
      className={cn(
        fieldControl,
        quietField,
        "-mx-[9px] min-h-9 w-[calc(100%+18px)] resize-none scroll-m-3 rounded-(--pn-r-3) px-2 py-1.5 text-[15px]/[22px] font-semibold md:text-[15px]/[22px]",
        "max-h-20 overflow-y-auto"
      )}
    />
  )
}
