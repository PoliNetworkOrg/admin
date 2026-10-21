import { useBlocker, useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { TriangleAlert } from "lucide-react"
import {
  type CSSProperties,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"

import {
  BarSkeleton,
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
import type { EsignConfig, EsignDocumentMeta, EsignPdfInfo, EsignProfile } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import {
  type ComposerSource,
  composerPrimary,
  declinedLine,
  invalidRecipient,
  parseRecipients,
  prefillDraft,
} from "./composer"
import { FieldError, quietField } from "./composer-fields"
import { DeliveryRows, REVEAL_MS, type SaveView } from "./delivery-rows"
import { DocumentDialogBody, DocumentPanes, useFileDrop } from "./document-picker"
import type { DriveFolder } from "./drive-browser"
import { getEsignDocumentContent } from "./esign.functions"
import { extractTextAnchors, type PdfFocus, PdfViewer, sizeOnPage, usePdfBytes } from "./pdf-viewer"
import {
  BOX_PT,
  type DraftPlace,
  defaultPlaces,
  findSpots,
  freeRow,
  placeRows,
  placeUnderRole,
  roleKey,
  type SignerDraft,
  type TextAnchor,
  withSignature,
} from "./places"
import { PlacingCancel } from "./placing"
import { createEsignRequest, importEsignDriveDocument, uploadEsignDocument } from "./requests.functions"
import { SignWithCie } from "./sign-with-cie"
import { type BoxPlacement, SignatureBox } from "./signature-box"
import { SignerPicker, SignerRow, SpotRow } from "./signer-rows"
import { useCanSignHere } from "./signing-device"
import { useFillHeight } from "./use-fill-height"

/**
 * The document of the request: `folder` is the drive folder it was picked in, `drive` the drive it comes from, which
 * decides who may sign it (null for an upload).
 */
type Staged = {
  id: string
  fileName: string
  sha256: string
  pdf: EsignPdfInfo
  folder: DriveFolder | null
  drive: string | null
}
/** Where the next click on a page puts a box: a row's existing place, or a new one when `place` is null. */
type Placing = { row: string; place: number | null }
/** Where the focus goes once the rows render: a row's picker, role or menu, or the free picker (`row: null`). */
type PendingFocus = { row: string | null; part: "picker" | "role" | "menu"; onlyIfLost?: boolean }

/** The folder the last PDF was picked from, `{ driveId, id }`, where the drive browser opens next time. */
const LAST_FOLDER_KEY = "pn-admin:esign-last-folder"
/** The title field grows to three lines, then scrolls. */
const TITLE_MAX_HEIGHT = 80
/** A document read faster than this shows no skeleton. */
const READING_SKELETON_MS = 400

function baseName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "")
}

function toStaged(
  result: { document: EsignDocumentMeta; pdf: EsignPdfInfo },
  folder: DriveFolder | null,
  drive: string | null
): Staged {
  const { id, fileName, sha256 } = result.document
  return { id, fileName, sha256, pdf: result.pdf, folder, drive }
}

function pdfFile(base64: string, fileName: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], fileName, { type: "application/pdf" })
}

/** The page size of the blank sheets shown while an earlier request's PDF opens. */
const A4 = { width: 595, height: 842 }

/** Brings a box into view, unless it already is: a nearby box doesn't make the viewer jump. */
const focusOn = (p: BoxPlacement): PdfFocus => ({
  page: p.page,
  y: p.y + p.height / 2,
  height: p.height,
  ifHidden: true,
})
const samePlace = (a: BoxPlacement, b: BoxPlacement) =>
  a.page === b.page && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

/**
 * New request: the document fills the left of the workspace, and one column on the right says who signs and where
 * the signed copy goes, with the primary action pinned at its foot. Before there is a document the same two places
 * offer the shared drives and a dropzone.
 *
 * With a `source` it starts from an earlier request ("Send again"): everything is filled in from it, and its PDF is
 * opened again from OneDrive, so a corrected file saved over the original is the one sent.
 */
export function NewEsignRequestPage({
  config,
  signers: people,
  me,
  source,
  sourceError,
}: {
  config: EsignConfig
  signers: EsignProfile[]
  me: string
  source: ComposerSource | null
  sourceError: string | null
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
  const [prefill] = useState(() =>
    source
      ? prefillDraft(
          source.request,
          config.drives.map((d) => d.id)
        )
      : null
  )

  const [staged, setStaged] = useState<Staged | null>(null)
  const [base64, setBase64] = useState<string | null>(null)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [docError, setDocError] = useState<{ from: "drive" | "upload"; message: string } | null>(
    sourceError ? { from: "drive", message: sourceError } : null
  )
  /** The earlier request's PDF is being opened: the workspace shows its pages as blank sheets meanwhile. */
  const [opening, setOpening] = useState(source !== null)
  /** The document that is the earlier request's own copy, because its OneDrive file couldn't be opened. */
  const [copyOf, setCopyOf] = useState<string | null>(null)
  /** The document "Check again" found unchanged in OneDrive. */
  const [stillSame, setStillSame] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [changingPdf, setChangingPdf] = useState(false)
  const bytes = usePdfBytes(base64)
  /** The text of the document on screen, where its signature spots are found; null while it is read. */
  const [anchors, setAnchors] = useState<TextAnchor[] | null>(null)
  useEffect(() => {
    if (!bytes) return
    let cancelled = false
    extractTextAnchors(bytes)
      .then((found) => {
        if (!cancelled) setAnchors(found)
      })
      .catch((error) => {
        // A PDF whose text can't be read is signed like one without labels.
        console.error(error)
        if (!cancelled) setAnchors([])
      })
    return () => {
      cancelled = true
    }
  }, [bytes])
  const reading = bytes !== null && anchors === null
  /** Until the document is open and read, its spots may still become rows: the signers and the primary wait. */
  const loading = opening || reading
  const [slowReading, setSlowReading] = useState(false)
  useEffect(() => {
    if (!loading) return setSlowReading(false)
    const timer = window.setTimeout(() => setSlowReading(true), READING_SKELETON_MS)
    return () => window.clearTimeout(timer)
  }, [loading])

  /** The signers group in signing order: people, and the spots found in the PDF, filled or not. */
  const [rows, setRows] = useState<SignerDraft[]>(prefill?.rows ?? [])
  /** Something was changed by hand, so leaving asks first. A request started from another one opens unchanged. */
  const [edited, setEdited] = useState(false)
  /** The signers as changed by hand. */
  function changeRows(update: SetStateAction<SignerDraft[]>) {
    setEdited(true)
    setRows(update)
  }
  const [placing, setPlacing] = useState<Placing | null>(null)
  const [focus, setFocus] = useState<PdfFocus | null>(null)
  /** The box whose menu is open, so it stands out among the same person's boxes. */
  const [highlight, setHighlight] = useState<{ row: string; place: number } | null>(null)
  /** The row with the pointer or the focus: its boxes are ringed. */
  const [rowPointed, setRowPointed] = useState<string | null>(null)
  /** The row whose box has the pointer: it is tinted. */
  const [boxPointed, setBoxPointed] = useState<string | null>(null)
  /** The empty spot whose box was clicked last, and how many times: its picker opens. */
  const [activation, setActivation] = useState({ row: "", count: 0 })
  /** "2 signature spots found", announced once per document. */
  const [spotsFound, setSpotsFound] = useState("")
  const [ordered, setOrdered] = useState(prefill?.ordered ?? true)

  // A request started from another one keeps its title, folder and file name when its document comes.
  const [title, setTitle] = useState(prefill?.title ?? "")
  const [titleTouched, setTitleTouched] = useState(prefill !== null)
  const [saveToDrive, setSaveToDrive] = useState(prefill?.saveToDrive ?? hasDrives)
  const [folder, setFolder] = useState<DriveFolder | null>(prefill?.folder ?? null)
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
  const [fileName, setFileName] = useState(prefill?.fileName ?? "")
  const [fileNameTouched, setFileNameTouched] = useState(Boolean(prefill?.fileName))
  const [folderTouched, setFolderTouched] = useState(Boolean(prefill?.folder))
  const [emails, setEmails] = useState(prefill?.emails ?? "")
  const [emailOpen, setEmailOpen] = useState(false)
  const [message, setMessage] = useState(prefill?.message ?? "")
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
    // Ringed even when the submit was a click or ⌘↵, which browsers don't count as moving the focus by keyboard.
    target.dataset.problemFocus = ""
    target.addEventListener("blur", () => delete target.dataset.problemFocus, { once: true })
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

  const blankPages = useMemo(
    () => Array.from({ length: source?.original.pages ?? 0 }, () => A4),
    [source?.original.pages]
  )
  const pages = staged?.pdf.pages ?? (opening ? blankPages : [])
  const driveLabel = (id: string) => config.drives.find((d) => d.id === id)?.label ?? "OneDrive"

  const pickerRef = useRef<HTMLInputElement>(null)
  const pendingFocus = useRef<PendingFocus | null>(null)
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    // Never take the focus from where the user moved on to.
    if (target.onlyIfLost && document.activeElement !== null && document.activeElement !== document.body) return
    const element =
      target.row === null
        ? pickerRef.current
        : column.current?.querySelector<HTMLElement>(
            `[data-row-id="${CSS.escape(target.row)}"] [data-row-${target.part}]`
          )
    element?.focus()
  }, [rows])

  /** The first document was just picked: once its spots are known, the focus moves on to the first one to fill. */
  const focusAfterPick = useRef(false)
  /** The document is the earlier request's again: signers without a spot keep the places they had on it. */
  const keepPlaces = useRef(false)
  /** The text the rows were last laid out on: each document's text lays them out once. */
  const laidOut = useRef<TextAnchor[] | null>(null)
  useEffect(() => {
    if (!staged || anchors === null || laidOut.current === anchors) return
    laidOut.current = anchors
    const spots = findSpots(anchors, staged.pdf.pages)
    const next = placeRows(rows, spots, anchors, staged.pdf.pages, { keepPlaces: keepPlaces.current })
    setRows(next)
    setPlacing(null)
    setSpotsFound(
      spots.length === 1 ? "1 signature spot found" : spots.length > 1 ? `${spots.length} signature spots found` : ""
    )
    // The first spot comes into view; without spots, the top of the first page.
    const first = spots[0]?.places[0]
    setFocus(first ? focusOn(first) : { page: 0, y: 0, ifHidden: true })
    if (focusAfterPick.current && window.matchMedia("(pointer: fine)").matches) {
      const empty = next.find((r) => !r.person)
      // A request started from another one comes complete: only a spot left to fill takes the focus.
      if (empty || !source) pendingFocus.current = { row: empty?.id ?? null, part: "picker" }
    }
    focusAfterPick.current = false
  }, [anchors, staged, rows, source])

  /**
   * Shows a document and lays the rows out on it. `again`: it is the earlier request's document, opened for it or
   * checked again, which keeps the signers' places and isn't a change made by hand.
   */
  function adopt(next: Staged, content: string, { again = false } = {}) {
    if (!staged) focusAfterPick.current = true
    keepPlaces.current = again
    if (!again) setEdited(true)
    setOpening(false)
    setStaged(next)
    setBase64(content)
    setChangingPdf(false)
    // The same PDF picked again keeps its text, and so its rows and boxes; another one is read and laid out anew.
    if (content !== base64) {
      setAnchors(null)
      setSpotsFound("")
      setFocus(null)
    }
    const name = baseName(next.fileName)
    if (!titleTouched || title.trim() === "") setTitle(name)
    if (!fileNameTouched || fileName.trim() === "") setFileName(`${name} - firmato.pdf`)
    const nextFolder = next.folder && (!folderTouched || !folder) ? next.folder : folder
    setFolder(nextFolder)
    // An uploaded PDF has no folder of its own: the question where to save it comes at once.
    setSaveView(hasDrives && saveToDrive && !nextFolder ? "browse" : "closed")
    setShown(({ email }) => ({ email }))
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
      adopt(toStaged(result, null, null), btoa(binary))
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
      adopt(toStaged(result, from, from.driveId), content.base64)
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

  /**
   * Opens the earlier request's PDF: its OneDrive file read again, so a corrected file saved over the original is the
   * one sent; else, for an upload or a file gone from OneDrive, the request's own first version, uploaded again as a
   * new document. Each ends up a new document, as the backend has no way to reuse one.
   */
  async function openSource({ original }: ComposerSource) {
    const from = original.source
    if (from.kind === "drive") {
      try {
        const result = await importFn({ data: { driveId: from.driveId, itemId: from.itemId } })
        const content = await contentFn({ data: { documentId: result.document.id } })
        return adopt(toStaged(result, null, from.driveId), content.base64, { again: true })
      } catch (error) {
        // Deleted, moved or out of reach: the request's own copy stands in, and the composer says so.
        console.error(error)
      }
    }
    try {
      const content = await contentFn({ data: { documentId: original.id } })
      const form = new FormData()
      form.set("file", pdfFile(content.base64, content.fileName))
      const result = await uploadFn({ data: form })
      adopt(toStaged(result, null, null), content.base64, { again: true })
      if (from.kind === "drive") setCopyOf(result.document.id)
    } catch (error) {
      // The rest stays filled in for whichever document is chosen.
      console.error(error)
      setOpening(false)
      setDocError({ from: "drive", message: "Couldn't open the PDF." })
    }
  }

  // Once, however often the loader runs again.
  const sourceOpened = useRef(false)
  useEffect(() => {
    if (!source || sourceOpened.current) return
    sourceOpened.current = true
    void openSource(source)
  }, [source])

  /** Reads the earlier request's OneDrive file again, and takes it when it changed. */
  async function checkAgain() {
    const from = source?.original.source
    if (!staged || from?.kind !== "drive") return
    setChecking(true)
    try {
      const result = await importFn({ data: { driveId: from.driveId, itemId: from.itemId } })
      if (result.document.sha256 === staged.sha256) setStillSame(staged.id)
      else {
        const content = await contentFn({ data: { documentId: result.document.id } })
        adopt(toStaged(result, staged.folder, from.driveId), content.base64, { again: true })
      }
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't open the OneDrive file.")
    } finally {
      setChecking(false)
    }
  }

  const pageDrop = useFileDrop((file) => void upload(file))
  const dialogDrop = useFileDrop((file) => void upload(file))

  const signerList = useFocusAfterRemoval<HTMLOListElement>("[data-signer-row]")
  const allPlaces = (except?: string) => rows.flatMap((r) => (r.id === except ? [] : r.places))

  /**
   * Adds a person without a spot. The boxes still in the default place are laid out again with theirs, so on the page
   * they read in signing order.
   */
  function addSigner(person: EsignProfile) {
    const laidOut = rows.filter((r) => r.places.some((p) => p.auto === "default"))
    const fixed = rows.flatMap((r) => r.places.filter((p) => p.auto !== "default"))
    const boxes = defaultPlaces(anchors ?? [], pages, fixed, laidOut.length + 1)
    const moved = new Map(laidOut.map((r, i) => [r.id, boxes[i]]))
    const row = freeRow({ sub: person.sub, name: person.name }, "", boxes[laidOut.length], "default")
    changeRows((current) => [
      ...current.map((r) => {
        const box = moved.get(r.id)
        return box ? { ...r, places: r.places.map((p) => (p.auto === "default" ? { ...p, ...box } : p)) } : r
      }),
      row,
    ])
    setFocus(focusOn(row.places[0]))
    pendingFocus.current = { row: row.id, part: "role" }
  }

  /** Puts a person in an empty spot; the focus moves on to the next empty one, else to the row's menu. */
  function fillSpot(id: string, person: EsignProfile) {
    const next = rows.map((r) => (r.id === id ? { ...r, person: { sub: person.sub, name: person.name } } : r))
    changeRows(next)
    const at = next.findIndex((r) => r.id === id)
    const following = [...next.slice(at + 1), ...next.slice(0, at)].find((r) => !r.person)
    pendingFocus.current = following ? { row: following.id, part: "picker" } : { row: id, part: "menu" }
  }

  /** "Remove" on a person: a spot row is emptied and gets its label's boxes back; a free row goes. */
  function removePerson(id: string, trigger: HTMLElement | null) {
    const row = rows.find((r) => r.id === id)
    if (!row?.spot) return removeRow(id, trigger)
    const { spot } = row
    changeRows((current) => current.map((r) => (r.id === id ? { ...r, person: null, places: spot.places } : r)))
    setPlacing(null)
    pendingFocus.current = { row: id, part: "picker" }
  }

  function removeRow(id: string, trigger: HTMLElement | null) {
    if (rows.length === 1) pendingFocus.current = { row: null, part: "picker" }
    else if (trigger) signerList.capture(trigger, { restore: true })
    changeRows((current) => current.filter((r) => r.id !== id))
    setPlacing(null)
    setRowPointed(null)
    setBoxPointed(null)
  }

  function moveRow(index: number, by: -1 | 1) {
    setPlacing(null)
    changeRows((current) => {
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })
  }

  /** The empty spot a role names, for a free row whose role is typed. */
  const spotFor = (role: string) => {
    const key = roleKey(role)?.key
    return key === undefined ? undefined : rows.find((r) => !r.person && r.spot?.key === key)
  }

  /**
   * A free row's role, as typed. Its box follows: to the empty spot the role names, else under the label naming it,
   * and stays where it is when the document doesn't name it or the user has moved it.
   */
  function setRole(id: string, role: string) {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const at = row.places.findIndex((p) => p.auto)
    const box = row.places[at]
    const target =
      box && anchors
        ? (spotFor(role)?.places[0] ??
          placeUnderRole(role, anchors, pages, [...allPlaces(id), ...row.places.filter((p) => p !== box)]))
        : null
    const moved = target && !samePlace(target, box)
    const places = moved
      ? row.places.map((p, i) => (i === at ? { ...target, kind: p.kind, auto: "label" as const } : p))
      : row.places
    if (moved) setFocus(focusOn(places[at]))
    changeRows((current) => current.map((r) => (r.id === id ? { ...r, role, places } : r)))
  }

  /** A free row whose finished role names an empty spot moves into it: one row for the person, at the label. */
  function claimSpot(id: string) {
    const row = rows.find((r) => r.id === id)
    const empty = row?.person ? spotFor(row.role) : undefined
    if (!row?.person || !empty?.spot) return
    const { person } = row
    const places = [...empty.spot.places, ...row.places.filter((p) => !p.auto)]
    changeRows((current) =>
      current.filter((r) => r.id !== id).map((r) => (r.id === empty.id ? { ...r, person, places } : r))
    )
    setPlacing(null)
    setRowPointed(null)
    pendingFocus.current = { row: empty.id, part: "menu", onlyIfLost: true }
  }

  function updatePlaces(id: string, update: (places: DraftPlace[]) => DraftPlace[]) {
    changeRows((current) => current.map((r) => (r.id === id ? { ...r, places: withSignature(update(r.places)) } : r)))
  }

  // The box comes back with every field it was given: rebuilt without `auto`, the composer no longer moves it.
  function movePlace(id: string, at: number, { page, x, y, width, height }: BoxPlacement) {
    updatePlaces(id, (places) => places.map((p, i) => (i === at ? { page, x, y, width, height, kind: p.kind } : p)))
  }

  function removePlace(id: string, at: number) {
    updatePlaces(id, (places) => places.filter((_, i) => i !== at))
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
    updatePlaces(placing.row, (places) =>
      (at === null
        ? [...places, { ...placement, kind: "signature" as const }]
        : places.map((p, i) => (i === at ? { ...placement, kind: p.kind } : p))
      ).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    )
    setPlacing(null)
  }

  // The drives the request uses decide who may sign it: where the PDF came from, and where it is saved.
  const usedDrives = [
    ...new Set([staged?.drive ?? undefined, saveToDrive ? folder?.driveId : undefined].filter((d) => d !== undefined)),
  ]
  const blockedDrive = (sub: string) => {
    const person = people.find((p) => p.sub === sub)
    return usedDrives.find((d) => !person?.drives.includes(d))
  }
  const eligible = useMemo(
    () => people.filter((p) => usedDrives.every((d) => p.drives.includes(d))),
    [people, usedDrives.join()]
  )
  /** The people who sign, in order: the rows with a person. */
  const signers = rows.flatMap((r) => (r.person ? [r.person] : []))
  const available = useMemo(
    () =>
      eligible
        .filter((p) => !signers.some((s) => s.sub === p.sub))
        .sort((a, b) => Number(b.sub === me) - Number(a.sub === me)),
    [eligible, signers.map((s) => s.sub).join(), me]
  )
  const meAddable = available.some((p) => p.sub === me)
  /** "Me" sits in the first slot to fill: the first empty spot, else the free picker. */
  const firstEmpty = rows.find((r) => !r.person)?.id
  /** Why a signer can't sign this request: no longer among those who may sign, or kept out by a drive's rule. */
  function cantSign(sub: string) {
    if (!people.some((p) => p.sub === sub)) return "Can't sign anymore."
    const drive = blockedDrive(sub)
    return drive === undefined ? undefined : `Can't sign documents of ${driveLabel(drive)}.`
  }
  const outsiders = signers.filter((s) => cantSign(s.sub) !== undefined)

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
    signers: rows.length > 0 ? undefined : "Add at least one signer.",
    title: title.trim() === "" ? "Give the request a title." : undefined,
    folder: saveToDrive && !folder ? "Choose a folder." : undefined,
    fileName: saveToDrive && folder && fileName.trim() === "" ? "Name the signed file." : undefined,
    email: badEmail ? `“${badEmail}” isn't an email address.` : undefined,
  }
  // Empty spots, and signers who may not sign these documents, block the request too; their rows say why.
  const problems = firstEmpty !== undefined || outsiders.length > 0 || Object.values(errors).some(Boolean)

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
  // An empty spot will hold someone, in its place in the order.
  const signerSubs = rows.map((r) => r.person?.sub ?? "")
  const primary = composerPrimary(signerSubs, me, ordered, canSignHere)
  const numbered = ordered && signers.length > 1
  /** The rows keep room for the numbers once a second row is there, so a second person doesn't move the first. */
  const numberColumn = ordered && rows.length > 1
  /** Order numbers count the people, not the empty spots. */
  const numbers = new Map(rows.filter((r) => r.person).map((r, i) => [r.id, i + 1]))

  /** Creates the request once: a signature that doesn't start leaves it on its page, ready to sign again. */
  const created = useRef<{ id: string; title: string } | null>(null)

  const creating = useRef(false)

  const dirty = createdRequest === null && edited
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
          signers: rows.flatMap(({ person, role, places }) =>
            person
              ? [
                  {
                    sub: person.sub,
                    role: role.trim() || null,
                    places: places.map(({ page, x, y, width, height, kind }) => ({ page, x, y, width, height, kind })),
                  },
                ]
              : []
          ),
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
    // No toast: the request's page says whom it waits for and that they were emailed.
    await openRequest(request.id)
    setSubmitting(false)
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
      const primary = () => primaryRef.current?.querySelector<HTMLButtonElement>("button")
      if (primary()?.disabled !== false) return
      event.preventDefault()
      // An open signer or role list closes first, and what its field does on blur (a typed role taking its spot) is
      // on screen before the primary runs, which may then be another button.
      const active = document.activeElement
      if (active instanceof HTMLElement && active.getAttribute("role") === "combobox") flushSync(() => active.blur())
      const button = primary()
      if (button && !button.disabled) button.click()
    }
    window.addEventListener("keydown", run)
    return () => window.removeEventListener("keydown", run)
  }, [])

  const shortcut = <Kbd onSolid>{modifier === "⌘" ? "⌘ ↵" : "Ctrl ↵"}</Kbd>
  const placingName = placing === null ? null : rows.find((r) => r.id === placing.row)?.person?.name
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
  /** The workspace shows from the start for a request started from another one, its PDF still opening. */
  const workspaceOn = staged !== null || opening

  const declined = source && declinedLine(source.request)
  /** The PDF on screen stands in for the OneDrive file, or is the very one that was declined. */
  function sourceWarning() {
    if (!source || !staged) return null
    if (copyOf === staged.id) return "Couldn't open the OneDrive file. This is the request's copy."
    if (source.request.status !== "declined" || staged.sha256 !== source.original.sha256) return null
    return stillSame === staged.id ? "Still the same PDF." : "Same PDF as before."
  }
  const warning = sourceWarning()
  const canCheckAgain = source?.original.source.kind === "drive" && copyOf !== staged?.id
  // While the PDF opens or is read, the signers group keeps the height it will have: one row for a first document; a
  // request started from another one has its rows, "Add signer" and, with two people, the order checkbox.
  const waitingRows = Math.max(rows.length, 1)
  const waitingRowsHeight = waitingRows * 40 + (waitingRows - 1) * 4
  const waitingHeight = rows.length === 0 ? waitingRowsHeight : waitingRowsHeight + 44 + (rows.length > 1 ? 32 : 0)

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
          {...(workspaceOn ? {} : pageDrop.handlers)}
        >
          <section
            aria-label={workspaceOn ? undefined : "Choose the document"}
            className="flex flex-col gap-4 @min-[900px]/composer:grid @min-[900px]/composer:h-(--workspace-h) @min-[900px]/composer:grid-cols-[minmax(0,1fr)_380px] @min-[1040px]/composer:grid-cols-[minmax(0,1fr)_400px]"
          >
            {!workspaceOn ? (
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
                        ? opening
                          ? "Opening the PDF…"
                          : null
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
                    overlay={(page) =>
                      !loading &&
                      rows.flatMap((row) =>
                        row.places.map((p, at) => {
                          if (p.page !== page) return null
                          const point = (hovering: boolean) =>
                            setBoxPointed((current) => (hovering ? row.id : current === row.id ? null : current))
                          // Keyed by the row, so a spot's box stays the same element when a person fills it.
                          const key = `${row.id}-${at}`
                          return row.person ? (
                            <SignatureBox
                              key={key}
                              placement={p}
                              label={row.person.name}
                              role={row.role || null}
                              number={numbered ? numbers.get(row.id) : undefined}
                              kind={p.kind}
                              state="active"
                              editable
                              highlighted={
                                (highlight?.row === row.id && highlight.place === at) || rowPointed === row.id
                              }
                              onChange={(placement) => movePlace(row.id, at, placement)}
                              onRemove={row.places.length > 1 ? () => removePlace(row.id, at) : undefined}
                              onHover={point}
                            />
                          ) : (
                            <SignatureBox
                              key={key}
                              placement={p}
                              label={row.role}
                              state="pending"
                              highlighted={rowPointed === row.id}
                              onHover={point}
                              onActivate={() => setActivation(({ count }) => ({ row: row.id, count: count + 1 }))}
                            />
                          )
                        })
                      )
                    }
                  />
                </div>

                <section
                  ref={column}
                  className={cn(
                    "flex min-h-0 min-w-0 flex-col rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)",
                    // Beside the viewer, as tall as its content up to the viewer's height: the primary stays right
                    // under the last row, and only a long column scrolls under a pinned footer.
                    "@min-[900px]/composer:max-h-full @min-[900px]/composer:self-start",
                    // Stacked, the page scrolls under the sticky footer: what takes the focus stops above it.
                    "@max-[899px]/composer:[&_*]:scroll-mb-20"
                  )}
                >
                  <div data-composer-body className="min-h-0 @min-[900px]/composer:overflow-y-auto">
                    <div className="flex flex-col gap-1 p-4">
                      <TitleField
                        value={title}
                        error={shown.title}
                        errorId={ids.titleError}
                        onChange={(value) => {
                          setTitle(value)
                          setTitleTouched(true)
                          setEdited(true)
                        }}
                        onBlur={() => revalidate("title")}
                      />
                      {shown.title && <FieldError id={ids.titleError}>{shown.title}</FieldError>}
                      {declined && <p className="text-[13px]/5 text-pretty text-(--pn-fg-muted)">{declined}</p>}
                      {source && (
                        <div aria-live="polite">
                          {warning && (
                            <div className="flex items-center justify-between gap-2">
                              <p className="flex items-start gap-1.5 py-1.5 text-[13px]/5 text-pretty text-(--pn-warning-fg)">
                                <TriangleAlert aria-hidden className="mt-[3px] size-3.5 shrink-0" />
                                {warning}
                              </p>
                              {canCheckAgain && (
                                <LoadingButton
                                  variant="ghost"
                                  className="-mr-2 shrink-0"
                                  pending={checking}
                                  onClick={checkAgain}
                                >
                                  Check again
                                </LoadingButton>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {staged && staged.pdf.signatures.length > 0 && (
                        <p className="text-[13px] text-(--pn-fg-muted)">
                          Already signed by {staged.pdf.signatures.map((s) => s.signerName).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col border-t border-(--pn-line) p-4">
                      <h2 className="sr-only">Signers</h2>
                      <p className="sr-only" aria-live="polite">
                        {spotsFound}
                      </p>
                      {loading ? (
                        <div style={{ height: waitingHeight }}>
                          {slowReading && (
                            <div style={{ height: waitingRowsHeight }}>
                              <BarSkeleton label="Reading the PDF…" bars={waitingRows} className="h-full" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {rows.length > 0 && (
                            <ol ref={signerList.surfaceRef} tabIndex={-1} className="mb-2 flex flex-col gap-1">
                              {rows.map((row, index) => {
                                const pointProps = {
                                  pointed: boxPointed === row.id,
                                  onPoint: (inside: boolean) =>
                                    setRowPointed((current) => (inside ? row.id : current === row.id ? null : current)),
                                }
                                if (!row.person)
                                  return (
                                    <SpotRow
                                      key={row.id}
                                      row={row}
                                      numbered={numberColumn}
                                      people={available}
                                      me={me}
                                      meAddable={meAddable}
                                      first={row.id === firstEmpty}
                                      emptyText={emptyText}
                                      attempted={attempted}
                                      {...pointProps}
                                      activation={activation.row === row.id ? activation.count : 0}
                                      onFocus={() => setFocus(focusOn(row.places[0]))}
                                      onPick={(person) => fillSpot(row.id, person)}
                                      onRemove={(trigger) => removeRow(row.id, trigger)}
                                    />
                                  )
                                return (
                                  <SignerRow
                                    key={row.id}
                                    row={row}
                                    person={row.person}
                                    index={index}
                                    count={rows.length}
                                    number={numbered ? numbers.get(row.id) : undefined}
                                    numbered={numberColumn}
                                    isMe={row.person.sub === me}
                                    cantSign={cantSign(row.person.sub)}
                                    attempted={attempted}
                                    {...pointProps}
                                    onRole={(role) => setRole(row.id, role)}
                                    onRoleDone={() => claimSpot(row.id)}
                                    onMove={(by) => moveRow(index, by)}
                                    onAddPlace={() => setPlacing({ row: row.id, place: null })}
                                    onMovePlace={(at) => setPlacing({ row: row.id, place: at })}
                                    onPlaceKind={(at, kind) =>
                                      updatePlaces(row.id, (places) =>
                                        places.map((p, i) => (i === at ? { ...p, kind } : p))
                                      )
                                    }
                                    onRemovePlace={(at) => removePlace(row.id, at)}
                                    onShowPlace={(at) => {
                                      setHighlight(at === null ? null : { row: row.id, place: at })
                                      const p = at === null ? undefined : row.places[at]
                                      if (p) setFocus(focusOn(p))
                                    }}
                                    onRemove={(trigger) => removePerson(row.id, trigger)}
                                  />
                                )
                              })}
                            </ol>
                          )}
                          <SignerPicker
                            folded={rows.some((r) => r.spot)}
                            people={available}
                            me={me}
                            meAddable={meAddable}
                            meLabel={meAddable && firstEmpty === undefined ? "Add me" : null}
                            emptyText={emptyText}
                            inputRef={pickerRef}
                            error={attempted ? errors.signers : undefined}
                            errorId={ids.signersError}
                            onPick={addSigner}
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
                                onCheckedChange={(value) => {
                                  setOrdered(Boolean(value))
                                  setEdited(true)
                                }}
                              />
                              Sign in this order
                            </label>
                          )}
                        </>
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
                          setEdited(true)
                        }}
                        onDontSave={() => {
                          setSaveToDrive(false)
                          setEdited(true)
                        }}
                        onFileName={(name) => {
                          setFileName(name)
                          setFileNameTouched(true)
                          setEdited(true)
                        }}
                        onFileNameBlur={() => revalidate("fileName")}
                        folderError={attempted ? errors.folder : undefined}
                        fileNameError={shown.fileName}
                        emails={emails}
                        recipients={recipients}
                        onEmails={(value) => {
                          setEmails(value)
                          setEdited(true)
                        }}
                        onEmailsBlur={() => revalidate("email")}
                        emailError={shown.email}
                        emailOpen={emailOpen}
                        onEmailOpen={setEmailOpen}
                        message={message}
                        onMessage={(value) => {
                          setMessage(value)
                          setEdited(true)
                        }}
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
                    {/* Busy while the PDF opens or is read: its spots may still become rows to fill. */}
                    <div
                      ref={primaryRef}
                      data-composer-primary
                      aria-busy={loading || undefined}
                      className="flex flex-col items-end gap-2 self-end"
                    >
                      {primary === "send" ? (
                        <LoadingButton
                          className="h-10 gap-2"
                          pending={submitting}
                          disabled={createdRequest !== null || loading}
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
                          disabled={submitting || createdRequest !== null || loading}
                          // The request page loads behind the dialog, so it is there, on the spot just signed and
                          // saying so, when the dialog lets go; navigating any earlier would unmount the dialog and lose
                          // the agent window.
                          handOff={async ([requestId]) => {
                            await router.preloadRoute({
                              to: "/dashboard/esign/requests/$requestId",
                              params: { requestId },
                            })
                          }}
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
