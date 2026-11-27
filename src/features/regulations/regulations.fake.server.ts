import { randomBytes } from "node:crypto"

import { diffWords } from "diff"
import * as Y from "yjs"

import { allowedPath } from "./editor/draft-files"
import { type FileNode, parseDocument, plainTitle } from "./latex-structure"
import type { RegulationsApi, RegulationsViewer } from "./regulations.api.server"
import type {
  ArticleChange,
  Assignment,
  Capabilities,
  CommentThread,
  Delega,
  Delibera,
  Diff,
  DocumentInfo,
  DocumentKind,
  DocumentStorage,
  Draft,
  DraftBase,
  DraftRole,
  DraftSummary,
  Emanation,
  Files,
  MergeConflict,
  MergePreview,
  Procedure,
  ProcedureKey,
  Snapshot,
  StateKey,
  Structure,
  StructureNode,
  SyncResult,
  TemplateInfo,
  UserMatch,
  ValidationIssue,
  VersionSummary,
} from "./regulations.contract"
import { FINAL_STATES } from "./regulations.contract"
import { type DevCollab, devCollab } from "./regulations.dev-collab.server"
import {
  CONSULTAZIONE_SAMPLES,
  ENTRY_FILE,
  FAKE_USERS,
  GENERALE_SAMPLE,
  PUBLISHED_FILES,
  skeletonFiles,
  UPLOAD_SAMPLES,
  USING_SAMPLE,
} from "./regulations.fixtures.server"

/**
 * Agent mode's stand-in for the backend's `regulations.*` procedures, following the rules the backend states: Direttivo
 * (`regulations:write`) edits every draft, `regulations:read` sees them all as a viewer, everyone else only the drafts
 * they're assigned to; one draft per document in approvazione; the delibera to approve; "Emana e notifica" walks
 * through PR, checks, merge, tag, release, email and Telegram a few seconds apart. Every kind of document has a sample:
 * the RRI (`rri`), a documento generale and a private one from a template (`documento`: bozza → pubblicata), an
 * uploaded PDF, Statuto and Regolamento Elettorale (sola consultazione), and repository documents still in creation.
 * Text lives in the dev collab server (`regulations.dev-collab.server.ts`), which the fake reads and writes for
 * snapshots, restores and merges. State lives for the dev server's lifetime.
 */

const DOCUMENT_KEY = "rri"
/** How long a repository document created here waits for its (imaginary) pull request to merge. */
const CREATION_MS = 20_000
const AGENT_ID = "agent-preview-user"
const SECRET_BLOCK = "La bozza è segreta: rendila visibile prima di avviare la procedura."
const CREATOR_STAYS = "Chi ha creato la bozza segreta ne resta editor."
const STEP_MS = 2500
const DIFF_DELAY_MS = 2500
const AUTO_SNAPSHOT_MS = 5 * 60_000

const RRI_PROCEDURE: Procedure = {
  key: "rri",
  states: [
    { key: "bozza", label: "Bozza", editable: true },
    { key: "in_approvazione", label: "In approvazione", editable: false },
    { key: "approvata", label: "Approvata", editable: false },
    { key: "emanata", label: "Emanata", editable: false },
  ],
  transitions: [
    { from: "bozza", to: "in_approvazione", label: "Invia in approvazione", kinds: ["modifica"] },
    { from: "in_approvazione", to: "bozza", label: "Riporta in bozza", kinds: ["modifica"] },
    { from: "in_approvazione", to: "approvata", label: "Registra l'approvazione", kinds: ["modifica"] },
    { from: "approvata", to: "bozza", label: "Riporta in bozza (annulla l'approvazione)", kinds: ["modifica"] },
    { from: "approvata", to: "emanata", label: "Emana e notifica", kinds: ["modifica"] },
    { from: "bozza", to: "emanata", label: "Emana rettifica", kinds: ["rettifica"] },
  ],
  deadlines: [
    { key: "emanazione", label: "Emanazione e notifica", days: 3, severity: "warning" },
    { key: "opposizione", label: "Opposizioni e ricorsi", days: 10, severity: "info" },
  ],
}

const DOCUMENTO_PROCEDURE: Procedure = {
  key: "documento",
  states: [
    { key: "bozza", label: "Bozza", editable: true },
    { key: "pubblicata", label: "Pubblicata", editable: false },
  ],
  transitions: [{ from: "bozza", to: "pubblicata", label: "Pubblica", kinds: ["modifica"] }],
  deadlines: [],
}

const PROCEDURES = { rri: RRI_PROCEDURE, documento: DOCUMENTO_PROCEDURE } satisfies Record<ProcedureKey, Procedure>

const TEMPLATES: TemplateInfo[] = [
  { key: "regolamento", title: "Regolamento", directory: "regolamenti/" },
  { key: "generale", title: "Documento generale", directory: "generali/" },
]

const REPOSITORY = "https://github.com/PoliNetworkOrg/documents"

type StoredSnapshot = Snapshot & { files: Files }
/** `pdf`: an uploaded file; otherwise the PDF is compiled from `files` (an upload's sample stands in as LaTeX). */
type StoredVersion = VersionSummary & { files: Files; entry: string; pdf?: Buffer }
type StoredDocument = Omit<DocumentInfo, "procedure" | "editable" | "latestVersion" | "openDrafts" | "inApproval"> & {
  entry: string
  /** A repository document created here becomes active once this passes (its pull request "merged"). */
  activateAt: number | null
}
type SeedComment = {
  file: string
  quote: string
  body: string
  author: UserMatch
  reply?: { body: string; author: UserMatch }
}
type StoredDraft = Omit<DraftSummary, "myRole" | "parses"> & {
  deleted: boolean
  entry: string
  files: Files
  baseFiles: Files
  assignments: Assignment[]
  comments: CommentThread[]
  seedComments: SeedComment[]
  snapshots: StoredSnapshot[]
  delibera: Delibera | null
  approvedAt: string | null
  emanatedAt: string | null
  notifiedAt: string | null
  versionId: string | null
  diff: { generation: number; requestedAt: number; by: UserMatch | null } | null
  emanation: { startedAt: number; startedBy: UserMatch; delegaId: string | null } | null
  lastActivity: number
}
type Store = { documents: StoredDocument[]; versions: StoredVersion[]; drafts: StoredDraft[]; deleghe: Delega[] }

function user(id: string): UserMatch {
  const found = FAKE_USERS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`Unknown fixture user ${id}`)
  return found
}
const now = () => new Date().toISOString()
const newId = () => randomBytes(9).toString("base64url")
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
// Calendar days in Italy, as the backend dates versions.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date())
const isFinal = (state: StateKey) => FINAL_STATES.some((final) => final === state)

class FakeError extends Error {}
const refuse = (message: string): never => {
  throw new FakeError(message)
}

/** The text of the published version before the latest one: the Raccolta as it was. */
function previousFiles(): Files {
  return edit(PUBLISHED_FILES, "regolamenti/fondamentale.tex", (text) =>
    text
      .replace("entro tre giorni dall'approvazione", "entro cinque giorni dall'approvazione")
      .replace(/\\articolo\[id=a4rett\][\s\S]*?(?=\\end\{capo\})/, "")
  )
}

/** The scripted edits apply to the invented sample only; with the real RRI, drafts start as the published text. */
function edit(files: Files, path: string, change: (text: string) => string): Files {
  const text = files[path]
  return USING_SAMPLE && text !== undefined ? { ...files, [path]: change(text) } : files
}

/** The whole document, as the PDF numbers it. */
function parse(files: Files, entry = ENTRY_FILE) {
  return parseDocument(files, entry)
}

function buildStore(): Store {
  const presidente = user("u-presidente")
  const segretario = user("u-segretario")
  const direttivo = user("u-direttivo")
  const old: StoredVersion = {
    id: "v-2025-09-30",
    documentKey: DOCUMENT_KEY,
    // The first import from the repository, labelled as the backend labels it: no tag and no release.
    tag: null,
    label: "import d08cb57",
    origin: "import",
    delibera: null,
    publishedAt: "2025-09-30T10:00:00.000Z",
    releaseUrl: null,
    pdfAvailable: true,
    draftId: null,
    files: previousFiles(),
    entry: ENTRY_FILE,
  }
  const emanatedDraftId = "spring2026rev"
  const latest: StoredVersion = {
    id: "v-2026-03-12",
    documentKey: DOCUMENT_KEY,
    tag: "rri-v2026.03.12",
    label: "v2026.03.12",
    origin: "draft",
    delibera: {
      kind: "approvazione",
      body: "consiglio_direttivo",
      date: "2026-03-12",
      verbaleUrl: "https://polinetwork.org/verbali/2026-03-12.pdf",
      recordedBy: segretario,
      recordedAt: "2026-03-12T21:30:00.000Z",
    },
    publishedAt: "2026-03-13T09:12:00.000Z",
    releaseUrl: `${REPOSITORY}/releases/tag/rri-v2026.03.12`,
    pdfAvailable: true,
    draftId: emanatedDraftId,
    files: PUBLISHED_FILES,
    entry: ENTRY_FILE,
  }
  const versionBase: DraftBase = { kind: "version", id: latest.id, label: latest.label }
  const agent = { id: AGENT_ID, name: "Preview Agent", email: "agent@polinetwork.org" }
  const assign = (who: UserMatch, role: DraftRole, by = direttivo): Assignment => ({
    user: who,
    role,
    assignedBy: by,
    assignedAt: daysAgo(6),
  })
  const draft = (fields: Partial<StoredDraft> & Pick<StoredDraft, "id" | "title" | "files">): StoredDraft => ({
    documentKey: DOCUMENT_KEY,
    kind: "modifica",
    state: "bozza",
    base: versionBase,
    secret: false,
    createdBy: direttivo,
    createdAt: daysAgo(9),
    updatedAt: daysAgo(1),
    stateChangedAt: daysAgo(9),
    deleted: false,
    entry: ENTRY_FILE,
    baseFiles: latest.files,
    assignments: [],
    comments: [],
    seedComments: [],
    snapshots: [],
    delibera: null,
    approvedAt: null,
    emanatedAt: null,
    notifiedAt: null,
    versionId: null,
    diff: null,
    emanation: null,
    lastActivity: 0,
    ...fields,
  })

  const fondamentale = draft({
    id: "fondamentale26",
    title: "Revisione del Regolamento Fondamentale",
    files: edit(PUBLISHED_FILES, "regolamenti/fondamentale.tex", (text) =>
      text
        .replace("entro \\textbf{trenta giorni}", "entro \\textbf{quindici giorni}")
        .replace(
          "\\articolo[id=a4rett]{Correzioni}",
          "\\articolo[id=a5dele]{Deleghe}\nIl Segretario può delegare la rettifica a un Socio, dandone notizia al Consiglio Direttivo.\n\n\\articolo[id=a4rett]{Correzioni}"
        )
    ),
    assignments: [assign(user("u-socio-1"), "editor"), assign(user("u-socio-2"), "commenter"), assign(agent, "editor")],
    seedComments: [
      {
        file: "regolamenti/fondamentale.tex",
        quote: "quindici giorni",
        body: "Quindici giorni bastano per le notifiche ordinarie? Lo Statuto ne prevede trenta per l'Assemblea.",
        author: user("u-socio-2"),
        reply: { body: "Per l'Assemblea resta lo Statuto: qui sono solo le notifiche ordinarie.", author: direttivo },
      },
    ],
  })
  const condotta = draft({
    id: "condotta-tavolo",
    title: "Tavolo di lavoro: condotta nei gruppi",
    createdBy: presidente,
    files: edit(
      edit(PUBLISHED_FILES, "regolamenti/condotta.tex", (text) =>
        text
          .replace("anche nei gruppi online.", "anche nei gruppi online e negli eventi.")
          .replace(
            "  \\comma[id=m2c003]",
            "  \\comma[id=m2c004] Gli Admin non usano i gruppi per promuovere iniziative estranee all'Associazione.\n  \\comma[id=m2c003]"
          )
      ),
      "regolamenti/fondamentale.tex",
      (text) => text.replace("entro \\textbf{trenta giorni}", "entro \\textbf{venti giorni lavorativi}")
    ),
    assignments: [assign(user("u-socio-3"), "editor", presidente), assign(agent, "commenter", presidente)],
  })
  const emanated = draft({
    id: emanatedDraftId,
    title: "Revisione di primavera 2026",
    state: "emanata",
    base: { kind: "version", id: old.id, label: old.label },
    baseFiles: old.files,
    files: latest.files,
    createdAt: "2026-02-20T18:00:00.000Z",
    updatedAt: "2026-03-13T09:12:00.000Z",
    stateChangedAt: "2026-03-13T09:12:00.000Z",
    delibera: latest.delibera,
    approvedAt: "2026-03-12T21:30:00.000Z",
    emanatedAt: "2026-03-13T09:12:00.000Z",
    notifiedAt: "2026-03-13T09:14:00.000Z",
    versionId: latest.id,
    diff: { generation: 1, requestedAt: Date.parse("2026-03-10T10:00:00.000Z"), by: null },
    emanation: { startedAt: Date.parse("2026-03-13T09:10:00.000Z"), startedBy: segretario, delegaId: null },
  })
  // Secret: the agent's, shared with one Socio, and the Presidente's, which nobody else sees.
  const riservata = draft({
    id: "quote-riservata",
    title: "Quote associative: proposta riservata",
    secret: true,
    createdBy: agent,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
    stateChangedAt: daysAgo(3),
    files: edit(PUBLISHED_FILES, "regolamenti/fondamentale.tex", (text) =>
      text.replace("entro \\textbf{trenta giorni}", "entro \\textbf{sessanta giorni}")
    ),
    assignments: [assign(agent, "editor", agent), assign(user("u-socio-1"), "commenter", agent)],
  })
  const presidenza = draft({
    id: "presidenza-segreta",
    title: "Riorganizzazione della Presidenza",
    secret: true,
    createdBy: presidente,
    files: PUBLISHED_FILES,
    assignments: [assign(presidente, "editor", presidente)],
  })
  for (const stored of [fondamentale, condotta, emanated, riservata, presidenza])
    stored.snapshots.push({
      id: newId(),
      draftId: stored.id,
      kind: "base",
      name: `Creata da ${stored.base.kind === "version" ? stored.base.label : stored.base.title}`,
      createdAt: stored.createdAt,
      createdBy: stored.createdBy,
      files: stored.baseFiles,
    })
  fondamentale.snapshots.push({
    id: newId(),
    draftId: fondamentale.id,
    kind: "named",
    name: "Prima proposta al Direttivo",
    createdAt: daysAgo(3),
    createdBy: direttivo,
    files: edit(fondamentale.files, "regolamenti/fondamentale.tex", (text) => text.replace("quindici", "venti")),
  })

  const others = otherDocuments(draft, { segretario, presidente, direttivo })
  for (const stored of others.drafts)
    stored.snapshots.push({
      id: newId(),
      draftId: stored.id,
      kind: "base",
      name: `Creata da ${stored.base.kind === "version" ? stored.base.label : stored.base.title}`,
      createdAt: stored.createdAt,
      createdBy: stored.createdBy,
      files: stored.baseFiles,
    })

  return {
    documents: [
      {
        key: DOCUMENT_KEY,
        title: "Raccolta dei Regolamenti Interni",
        kind: "regolamento",
        storage: "repo",
        origin: "latex",
        template: "regolamento",
        procedureKey: "rri",
        status: "active",
        creation: null,
        tagPrefix: "rri-",
        entry: ENTRY_FILE,
        activateAt: null,
      },
      ...others.documents,
    ],
    versions: [latest, old, ...others.versions],
    drafts: [fondamentale, condotta, riservata, presidenza, emanated, ...others.drafts],
    deleghe: [
      {
        id: newId(),
        grantee: user("u-probiviro"),
        documentKey: DOCUMENT_KEY,
        expiresAt: "2026-12-31T22:59:59.000Z",
        note: "Correzioni dopo la revisione di primavera.",
        grantedBy: segretario,
        createdAt: "2026-04-02T12:00:00.000Z",
        revokedAt: null,
        revokedBy: null,
        active: true,
      },
    ],
  }
}

type DraftFactory = (fields: Partial<StoredDraft> & Pick<StoredDraft, "id" | "title" | "files">) => StoredDraft

/** A repository or private document of the sample, the RRI aside. */
function sampleDocument(
  fields: Pick<StoredDocument, "key" | "title" | "kind" | "storage"> & Partial<StoredDocument>
): StoredDocument {
  return {
    origin: "latex",
    template: null,
    procedureKey: null,
    status: "active",
    creation: null,
    tagPrefix: `${fields.key}-`,
    entry: `${fields.key}.tex`,
    activateAt: null,
    ...fields,
  }
}

/**
 * Every other kind of document: a documento generale with a published draft and an open one, a private document from
 * the generale template, an uploaded PDF with two versions, Statuto and Regolamento Elettorale (sola consultazione), a
 * repository document whose pull request is open and one whose pull request was closed.
 */
function otherDocuments(
  draft: DraftFactory,
  people: { segretario: UserMatch; presidente: UserMatch; direttivo: UserMatch }
) {
  const { segretario, presidente, direttivo } = people
  const version = (
    fields: Pick<StoredVersion, "id" | "documentKey" | "label" | "origin" | "publishedAt" | "files" | "entry"> &
      Partial<StoredVersion>
  ): StoredVersion => ({
    tag: null,
    delibera: null,
    releaseUrl: null,
    pdfAvailable: true,
    draftId: null,
    ...fields,
  })

  const guida = sampleDocument({
    key: "guida-della-matricola",
    title: "Guida della Matricola",
    kind: "generale",
    storage: "repo",
    template: "generale",
    procedureKey: "documento",
  })
  const guidaOld = GENERALE_SAMPLE.guida("2025/26")
  const guidaNew = GENERALE_SAMPLE.guida("2026/27")
  const guidaImport = version({
    id: "v-guida-import",
    documentKey: guida.key,
    label: "import 3f2a1c9",
    origin: "import",
    publishedAt: "2025-09-30T10:00:00.000Z",
    files: guidaOld,
    entry: guida.entry,
  })
  const guidaPublished = version({
    id: "v-guida-2026",
    documentKey: guida.key,
    tag: "guida-della-matricola-v2026.09.01",
    label: "v2026.09.01",
    origin: "draft",
    publishedAt: "2026-09-01T08:30:00.000Z",
    releaseUrl: `${REPOSITORY}/releases/tag/guida-della-matricola-v2026.09.01`,
    draftId: "guida-2026",
    files: guidaNew,
    entry: guida.entry,
  })
  const guidaDraftPublished = draft({
    id: "guida-2026",
    documentKey: guida.key,
    title: "Guida per l'anno 2026/27",
    state: "pubblicata",
    entry: guida.entry,
    base: { kind: "version", id: guidaImport.id, label: guidaImport.label },
    baseFiles: guidaOld,
    files: guidaNew,
    createdAt: "2026-08-10T16:00:00.000Z",
    updatedAt: "2026-09-01T08:30:00.000Z",
    stateChangedAt: "2026-09-01T08:30:00.000Z",
    emanatedAt: "2026-09-01T08:30:00.000Z",
    versionId: guidaPublished.id,
    emanation: { startedAt: Date.parse("2026-09-01T08:28:00.000Z"), startedBy: presidente, delegaId: null },
  })
  const guidaDraftOpen = draft({
    id: "guida-2027",
    documentKey: guida.key,
    title: "Aggiornamento per l'anno 2027/28",
    entry: guida.entry,
    base: { kind: "version", id: guidaPublished.id, label: guidaPublished.label },
    baseFiles: guidaNew,
    files: GENERALE_SAMPLE.guida("2027/28"),
    createdBy: direttivo,
  })

  const lineeGuida = sampleDocument({
    key: "linee-guida-direttivo",
    title: "Linee guida interne del Direttivo",
    kind: "privato",
    storage: "private",
    template: "generale",
    procedureKey: "documento",
    entry: "main.tex",
  })
  const lineeTemplate = skeletonFiles("generale", lineeGuida.title, lineeGuida.key, "2026-10-02").files
  const lineeText = GENERALE_SAMPLE.lineeGuida()
  const lineeStart = version({
    id: "v-linee-modello",
    documentKey: lineeGuida.key,
    label: "Modello",
    origin: "template",
    publishedAt: "2026-10-02T18:00:00.000Z",
    files: lineeTemplate,
    entry: lineeGuida.entry,
  })
  const lineePublished = version({
    id: "v-linee-2026",
    documentKey: lineeGuida.key,
    label: "v2026.10.20",
    origin: "draft",
    publishedAt: "2026-10-20T19:15:00.000Z",
    draftId: "linee-prima",
    files: lineeText,
    entry: lineeGuida.entry,
  })
  const lineeDraft = draft({
    id: "linee-prima",
    documentKey: lineeGuida.key,
    title: "Prima stesura",
    state: "pubblicata",
    entry: lineeGuida.entry,
    base: { kind: "version", id: lineeStart.id, label: lineeStart.label },
    baseFiles: lineeTemplate,
    files: lineeText,
    createdBy: segretario,
    createdAt: "2026-10-03T09:00:00.000Z",
    updatedAt: "2026-10-20T19:15:00.000Z",
    stateChangedAt: "2026-10-20T19:15:00.000Z",
    emanatedAt: "2026-10-20T19:15:00.000Z",
    versionId: lineePublished.id,
    emanation: { startedAt: Date.parse("2026-10-20T19:15:00.000Z"), startedBy: segretario, delegaId: null },
  })

  const bilancio = sampleDocument({
    key: "bilancio-consuntivo-2025",
    title: "Bilancio consuntivo 2025",
    kind: "privato",
    storage: "private",
    origin: "upload",
    entry: "",
  })
  const bilancioVersions = UPLOAD_SAMPLES.bilancio.map((sample, index) =>
    version({
      id: `v-bilancio-${index + 1}`,
      documentKey: bilancio.key,
      label: sample.label,
      origin: "upload",
      publishedAt: sample.publishedAt,
      files: sample.files,
      entry: sample.entry,
    })
  )

  const consultazione = CONSULTAZIONE_SAMPLES.map((sample) => ({
    document: sampleDocument({
      key: sample.key,
      title: sample.title,
      kind: "consultazione",
      storage: "repo",
      entry: sample.entry,
    }),
    version: version({
      id: `v-${sample.key}-import`,
      documentKey: sample.key,
      label: "import 9c41e07",
      origin: "import",
      publishedAt: "2025-09-30T10:00:00.000Z",
      files: sample.files,
      entry: sample.entry,
    }),
  }))

  const creating = sampleDocument({
    key: "regolamento-eventi",
    title: "Regolamento degli eventi",
    kind: "regolamento",
    storage: "repo",
    template: "regolamento",
    procedureKey: "documento",
    status: "creating",
    creation: {
      prNumber: 58,
      prUrl: `${REPOSITORY}/pull/58`,
      error: null,
      startedAt: new Date(Date.now() - 40 * 60_000).toISOString(),
      startedBy: segretario,
    },
  })
  const failed = sampleDocument({
    key: "carta-dei-servizi",
    title: "Carta dei servizi",
    kind: "generale",
    storage: "repo",
    template: "generale",
    procedureKey: "documento",
    status: "failed",
    creation: {
      prNumber: 55,
      prUrl: `${REPOSITORY}/pull/55`,
      error: "La pull request #55 è stata chiusa senza unirla.",
      startedAt: daysAgo(3),
      startedBy: presidente,
    },
  })

  return {
    documents: [guida, lineeGuida, bilancio, ...consultazione.map((entry) => entry.document), creating, failed],
    versions: [
      guidaPublished,
      guidaImport,
      lineePublished,
      lineeStart,
      ...bilancioVersions.reverse(),
      ...consultazione.map((entry) => entry.version),
    ],
    drafts: [guidaDraftOpen, guidaDraftPublished, lineeDraft],
  }
}

type Global = typeof globalThis & { __regulationsFakeStore?: Store }

function store(): Store {
  // SAFETY: `Global` only adds an optional property to `globalThis`.
  const holder = globalThis as Global
  holder.__regulationsFakeStore ??= buildStore()
  return holder.__regulationsFakeStore
}

function collab(): Promise<DevCollab> {
  return devCollab({
    initialFiles: (draftId) => store().drafts.find((draft) => draft.id === draftId)?.files ?? null,
    entry: (draftId) => store().drafts.find((draft) => draft.id === draftId)?.entry ?? ENTRY_FILE,
    onLoaded: (draftId, document) => {
      const draft = store().drafts.find((candidate) => candidate.id === draftId)
      if (draft) seedComments(draft, document)
    },
    onFiles: (draftId, files) => {
      const draft = store().drafts.find((candidate) => candidate.id === draftId)
      if (!draft) return
      draft.files = files
      draft.updatedAt = now()
      if (Date.now() - draft.lastActivity > AUTO_SNAPSHOT_MS) {
        const last = draft.snapshots.at(-1)
        if (!last || JSON.stringify(last.files) !== JSON.stringify(files))
          draft.snapshots.push({
            id: newId(),
            draftId,
            kind: "auto",
            name: null,
            createdAt: now(),
            createdBy: null,
            files,
          })
      }
      draft.lastActivity = Date.now()
    },
  })
}

/** Comments in the sample data, anchored once the collab server has the draft's document. */
function seedComments(draft: StoredDraft, document: Y.Doc) {
  for (const seed of draft.seedComments.splice(0)) {
    const text = document.getMap<Y.Text>("files").get(seed.file)
    const index = text?.toString().indexOf(seed.quote) ?? -1
    if (!text || index < 0) continue
    const encode = (at: number, assoc: number) =>
      Buffer.from(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, at, assoc))).toString("base64")
    const thread: CommentThread = {
      id: newId(),
      draftId: draft.id,
      body: seed.body,
      author: seed.author,
      createdAt: daysAgo(2),
      editedAt: null,
      deleted: false,
      anchor: { file: seed.file, start: encode(index, 0), end: encode(index + seed.quote.length, -1) },
      quote: seed.quote,
      resolvedAt: null,
      resolvedBy: null,
      replies: seed.reply
        ? [
            {
              id: newId(),
              body: seed.reply.body,
              author: seed.reply.author,
              createdAt: daysAgo(1),
              editedAt: null,
              deleted: false,
            },
          ]
        : [],
    }
    draft.comments.push(thread)
  }
}

// Documents.

function documentOf(documentKey: string): StoredDocument {
  activateCreated()
  return store().documents.find((document) => document.key === documentKey) ?? refuse("Documento non trovato.")
}

function procedureOf(documentKey: string): Procedure {
  const key = documentOf(documentKey).procedureKey
  return key ? PROCEDURES[key] : refuse("Questo documento è di sola consultazione.")
}

function versionSummary({ files: _files, entry: _entry, pdf: _pdf, ...summary }: StoredVersion): VersionSummary {
  return summary
}

/** Newest first. */
function versionsOf(documentKey: string) {
  return store()
    .versions.filter((version) => version.documentKey === documentKey)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

/** `v2026.11.22`, then `v2026.11.22.2`, … the same day, as the backend labels a version. */
function nextLabel(document: StoredDocument) {
  const stem = `v${today().replaceAll("-", ".")}`
  const labels = new Set(versionsOf(document.key).map((version) => version.label))
  for (let n = 1; ; n++) {
    const label = n === 1 ? stem : `${stem}.${n}`
    if (!labels.has(label)) return label
  }
}

/** Why no draft can start from this document, or `null`. */
function notEditableReason(document: StoredDocument) {
  if (document.status !== "active") return "Il documento è ancora in creazione."
  if (document.origin === "upload") return "Un PDF caricato non si modifica: carica una nuova versione."
  if (!document.procedureKey) return "Questo documento è di sola consultazione: si modifica solo nel repository."
  return null
}

/** Repository documents created here: their pull request "merges" after `CREATION_MS`, with the skeleton as version. */
function activateCreated() {
  for (const document of store().documents) {
    if (document.status !== "creating" || document.activateAt === null || Date.now() < document.activateAt) continue
    document.status = "active"
    document.creation = null
    document.activateAt = null
    const { files } = skeletonFiles(document.template ?? "generale", document.title, document.key, today())
    store().versions.unshift({
      id: newId(),
      documentKey: document.key,
      tag: null,
      label: `import ${randomBytes(4).toString("hex").slice(0, 7)}`,
      origin: "import",
      delibera: null,
      publishedAt: now(),
      releaseUrl: null,
      pdfAvailable: true,
      draftId: null,
      files,
      entry: document.entry,
    })
  }
}

/**
 * The key is free across repository and private documents (a failed creation may be replaced by a repository one),
 * and a repository document's tag prefix can't be confused with another's. Returns the failed document it replaces.
 */
function checkNewKey(key: string, storage: DocumentStorage) {
  activateCreated()
  const existing = store().documents.find((document) => document.key === key) ?? null
  if (existing && !(existing.status === "failed" && storage === "repo"))
    refuse("Esiste già un documento con questa chiave.")
  if (storage === "repo") {
    const prefix = `${key}-`
    const clash = store().documents.find(
      (document) =>
        document.key !== key &&
        document.storage === "repo" &&
        (document.tagPrefix.startsWith(prefix) || prefix.startsWith(document.tagPrefix))
    )
    if (clash) refuse(`La chiave si confonde con i tag di «${clash.key}» (${clash.tagPrefix}…): scegline un'altra.`)
  }
  return existing
}

const PDF_MAGIC = "%PDF-"
const MAX_UPLOAD = 20 * 1024 * 1024

async function readPdf(file: File) {
  if (file.size > MAX_UPLOAD) refuse("Il PDF supera i 20 MB.")
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.subarray(0, PDF_MAGIC.length).toString() !== PDF_MAGIC) refuse("Il file non è un PDF.")
  return bytes
}

function insertUpload(document: StoredDocument, pdf: Buffer): StoredVersion {
  const version: StoredVersion = {
    id: newId(),
    documentKey: document.key,
    tag: null,
    label: nextLabel(document),
    origin: "upload",
    delibera: null,
    publishedAt: now(),
    releaseUrl: null,
    pdfAvailable: true,
    draftId: null,
    files: {},
    entry: "",
    pdf,
  }
  store().versions.unshift(version)
  return version
}

// Structure, as the backend's parser reports it.

/**
 * A document's source globs, as documents.json would give them: the entry and `<dir>/*.tex` for each folder of its
 * latest version (`*.tex` when every file is at the top).
 */
function sourcesOf(documentKey: string): string[] {
  const latest = versionsOf(documentKey)[0]
  if (!latest) return []
  const dirs = new Set(
    Object.keys(latest.files)
      .filter((path) => path.includes("/"))
      .map((path) => path.slice(0, path.lastIndexOf("/")))
  )
  return dirs.size ? [latest.entry, ...[...dirs].sort().map((dir) => `${dir}/*.tex`)] : ["*.tex"]
}

/** The text of a draft as the backend checks it: the parser's problems and files outside the document's sources. */
function draftStructure(draft: { files: Files; entry: string; documentKey: string }): Structure {
  const structure = structureOf(draft.files, draft.entry)
  const sources = sourcesOf(draft.documentKey)
  const stray = sources.length
    ? Object.keys(draft.files)
        .filter((path) => !allowedPath(path, sources))
        .sort()
    : []
  if (!stray.length) return structure
  const allowed = sources.map((glob) => `«${glob}»`).join(", ")
  const issues: ValidationIssue[] = stray.map((file) => ({
    file,
    line: 1,
    column: 1,
    offset: 0,
    endOffset: 0,
    severity: "error",
    code: "stray_file",
    message: `Il file «${file}» non è tra i sorgenti del documento (${allowed}): rinominalo o eliminalo.`,
  }))
  return { ...structure, parses: false, issues: [...issues, ...structure.issues] }
}

function structureOf(files: Files, entry = ENTRY_FILE): Structure {
  const root: StructureNode = {
    id: "documento",
    kind: "documento",
    number: null,
    label: "Documento",
    title: null,
    file: entry,
    range: { start: 0, end: 0 },
    children: [],
  }
  const { nodes, problems } = parse(files, entry)
  const issues: ValidationIssue[] = problems.map((problem) => {
    const before = (files[problem.file] ?? "").slice(0, problem.from).split("\n")
    return {
      file: problem.file,
      line: before.length,
      column: (before.at(-1)?.length ?? 0) + 1,
      offset: problem.from,
      endOffset: problem.to,
      severity: "error",
      code: "structure",
      message: problem.message,
    }
  })
  const stack: { node: StructureNode; depth: number }[] = [{ node: root, depth: -1 }]
  for (const node of nodes) {
    while (stack.length > 1 && (stack.at(-1)?.depth ?? -1) >= node.depth) stack.pop()
    const parent = stack.at(-1)?.node ?? root
    const converted: StructureNode = {
      id: node.id ?? `${parent.id}.${node.number}`,
      kind: node.kind,
      number: node.number,
      label: node.reference.split(", ").at(-1) ?? node.reference,
      title: node.title,
      file: node.file,
      range: { start: node.from, end: node.to },
      children: [],
    }
    parent.children.push(converted)
    stack.push({ node: converted, depth: node.depth })
  }
  return { parses: issues.length === 0, tree: root, issues }
}

// Viewer, roles and capabilities.

function api(viewer: RegulationsViewer): RegulationsApi {
  const can = (permission: string) => viewer.permissions.includes(permission)
  const me = viewer.user

  const delegaFor = (documentKey: string) =>
    store().deleghe.find(
      (delega) =>
        delega.active &&
        delega.grantee.id === me.id &&
        (delega.documentKey === null || delega.documentKey === documentKey) &&
        (delega.expiresAt === null || Date.parse(delega.expiresAt) > Date.now())
    ) ?? null
  const mayRectify = (documentKey: string) => can("regulations:rectify") || delegaFor(documentKey) !== null

  const isCreator = (draft: StoredDraft) => draft.createdBy.id === me.id

  function roleOf(draft: StoredDraft): DraftRole | null {
    // A secret draft: its creator and the members they added, whatever their permissions.
    if (draft.secret)
      return isCreator(draft)
        ? "editor"
        : (draft.assignments.find((assignment) => assignment.user.id === me.id)?.role ?? null)
    if (can("regulations:write")) return "editor"
    const assigned = draft.assignments.find((assignment) => assignment.user.id === me.id)?.role
    if (assigned) return assigned
    if (draft.kind === "rettifica" && draft.createdBy.id === me.id) return "editor"
    return can("regulations:read") ? "viewer" : null
  }

  function visible(draftId: string) {
    const draft = store().drafts.find((candidate) => candidate.id === draftId && !candidate.deleted)
    if (!draft) return refuse("Bozza non trovata.")
    const role = roleOf(draft)
    if (!role) return refuse("Bozza non trovata.")
    settle(draft)
    return { draft, role }
  }

  function inApproval(draft: StoredDraft) {
    return store().drafts.find(
      (other) =>
        other.id !== draft.id &&
        !other.deleted &&
        other.documentKey === draft.documentKey &&
        (other.state === "in_approvazione" || other.state === "approvata")
    )
  }

  /** As the backend: a secret draft's procedure stays closed, and only its creator manages it. */
  function capabilities(draft: StoredDraft, role: DraftRole): Capabilities {
    const open = procedureCapabilities(draft, role)
    if (!draft.secret) return { ...open, reveal: false }
    return {
      ...open,
      assign: isCreator(draft) && !isFinal(draft.state),
      merge: open.merge && role === "editor",
      transitions: open.transitions.map((transition) => ({ ...transition, blockedBy: SECRET_BLOCK })),
      approve: false,
      emanate: false,
      emanateBlockedBy: open.emanate || open.emanateBlockedBy ? SECRET_BLOCK : null,
      regenerateDiff: false,
      delete: isCreator(draft) && draft.state === "bozza" && draft.emanation === null,
      rename: role === "editor" && !isFinal(draft.state),
      reveal: isCreator(draft),
    }
  }

  function procedureCapabilities(draft: StoredDraft, role: DraftRole): Omit<Capabilities, "reveal"> {
    const procedure = procedureOf(draft.documentKey)
    const editable = procedure.states.find((state) => state.key === draft.state)?.editable ?? false
    const emanating = draft.emanation !== null && !isFinal(draft.state)
    const parses = draftStructure(draft).parses
    const writer = can("regulations:write")
    if (procedure.key === "documento") {
      // bozza → pubblicata in one step, "Pubblica", by Presidente or Segretario; nothing to approve or notify.
      const publishable = can("regulations:manage") && draft.state === "bozza" && draft.emanation === null
      return {
        edit: role === "editor" && editable && !emanating,
        comment: role !== "viewer" && !isFinal(draft.state),
        assign: writer && !isFinal(draft.state),
        merge: writer && draft.state === "bozza",
        transitions: [],
        approve: false,
        emanate: publishable && parses,
        emanateBlockedBy:
          publishable && !parses ? "Il testo non è valido: correggi gli errori prima di pubblicare." : null,
        rectify: false,
        regenerateDiff: false,
        delete: writer && draft.state === "bozza" && draft.emanation === null,
        rename: role === "editor" && !isFinal(draft.state),
        snapshot: role === "editor",
        restore: role === "editor" && editable && !emanating,
      }
    }
    const transitions: Capabilities["transitions"] = []
    if (draft.kind === "modifica" && writer && draft.state === "bozza") {
      const other = inApproval(draft)
      transitions.push({
        to: "in_approvazione",
        label: "Invia in approvazione",
        requires: [],
        blockedBy: !parses
          ? "Il testo non è valido: correggi gli errori prima di inviarlo in approvazione."
          : other
            ? "C'è già una bozza in approvazione per questo documento."
            : null,
      })
    }
    if (draft.kind === "modifica" && writer && draft.state === "in_approvazione")
      transitions.push({ to: "bozza", label: "Riporta in bozza", requires: [], blockedBy: null })
    if (
      draft.kind === "modifica" &&
      can("regulations:manage") &&
      draft.state === "approvata" &&
      draft.emanation === null
    )
      transitions.push({
        to: "bozza",
        label: "Riporta in bozza (annulla l'approvazione)",
        requires: [],
        blockedBy: null,
      })
    const approve = draft.kind === "modifica" && can("regulations:manage") && draft.state === "in_approvazione"
    if (approve)
      transitions.push({ to: "approvata", label: "Registra l'approvazione", requires: ["delibera"], blockedBy: null })
    const emanate =
      draft.emanation === null &&
      ((draft.kind === "modifica" && draft.state === "approvata" && can("regulations:manage")) ||
        (draft.kind === "rettifica" && draft.state === "bozza" && mayRectify(draft.documentKey) && parses))
    return {
      edit: role === "editor" && editable && !emanating,
      comment: role !== "viewer",
      assign: writer && !isFinal(draft.state),
      merge: writer && draft.state === "bozza",
      transitions,
      approve,
      emanate,
      rectify: mayRectify(draft.documentKey),
      regenerateDiff: can("regulations:manage") && draft.diff !== null && draft.notifiedAt === null,
      emanateBlockedBy:
        !emanate &&
        draft.emanation === null &&
        draft.kind === "rettifica" &&
        draft.state === "bozza" &&
        mayRectify(draft.documentKey) &&
        !parses
          ? "Il testo non è valido: correggi gli errori prima di emanare la rettifica."
          : null,
      delete: (writer || (draft.kind === "rettifica" && draft.createdBy.id === me.id)) && draft.state === "bozza",
      rename: (writer || (draft.kind === "rettifica" && draft.createdBy.id === me.id)) && !isFinal(draft.state),
      snapshot: role === "editor",
      restore: role === "editor" && editable && !emanating,
    }
  }

  /** Its members may not be this draft's. */
  function secretBase(base: DraftBase): DraftBase {
    if (base.kind !== "draft") return base
    const parent = store().drafts.find((candidate) => candidate.id === base.id)
    return parent?.secret ? { ...base, title: "Bozza segreta" } : base
  }

  function summary(draft: StoredDraft, role: DraftRole): DraftSummary {
    return {
      id: draft.id,
      documentKey: draft.documentKey,
      title: draft.title,
      kind: draft.kind,
      state: draft.state,
      base: secretBase(draft.base),
      myRole: role,
      secret: draft.secret,
      createdBy: draft.createdBy,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      stateChangedAt: draft.stateChangedAt,
      parses: draftStructure(draft).parses,
    }
  }

  function deadlines(draft: StoredDraft): Draft["deadlines"] {
    const result: Draft["deadlines"] = []
    if (draft.approvedAt && draft.kind === "modifica") {
      const dueAt = new Date(Date.parse(draft.approvedAt) + 3 * 86_400_000).toISOString()
      result.push({
        key: "emanazione",
        label: "Emanazione e notifica",
        dueAt,
        severity: "warning",
        overdue: draft.notifiedAt === null && Date.parse(dueAt) < Date.now(),
      })
    }
    if (draft.emanatedAt && draft.kind === "modifica" && procedureOf(draft.documentKey).key === "rri")
      result.push({
        key: "opposizione",
        label: "Opposizioni e ricorsi",
        dueAt: new Date(Date.parse(draft.emanatedAt) + 10 * 86_400_000).toISOString(),
        severity: "info",
        overdue: false,
      })
    return result
  }

  function setState(draft: StoredDraft, state: StateKey, label: string) {
    draft.state = state
    draft.stateChangedAt = now()
    draft.updatedAt = now()
    draft.snapshots.push({
      id: newId(),
      draftId: draft.id,
      kind: "state",
      name: label,
      createdAt: now(),
      createdBy: me,
      files: draft.files,
    })
    void collab().then((service) => service.notifyState(draft.id, state))
  }

  /** Emanation advances with time: one step every few seconds, then the version exists and the draft is emanata. */
  function settle(draft: StoredDraft) {
    if (!draft.emanation || isFinal(draft.state)) return
    const steps = emanationSteps(draft)
    if (steps.every((step) => step.state === "done" || step.state === "skipped")) {
      const document = documentOf(draft.documentKey)
      const procedure = procedureOf(draft.documentKey)
      const versions = store().versions
      // A repository document is tagged and released; a private one only gets the next label of the day.
      const label = nextLabel(document)
      const tag = document.storage === "repo" ? `${document.tagPrefix}${label}` : null
      const version: StoredVersion = {
        id: newId(),
        documentKey: draft.documentKey,
        tag,
        label,
        origin: "draft",
        delibera: procedure.key === "rri" ? draft.delibera : null,
        publishedAt: now(),
        releaseUrl: tag ? `${REPOSITORY}/releases/tag/${tag}` : null,
        pdfAvailable: true,
        draftId: draft.id,
        files: draft.files,
        entry: draft.entry,
      }
      versions.unshift(version)
      draft.versionId = version.id
      draft.emanatedAt = now()
      if (procedure.key === "rri") draft.notifiedAt = now()
      const final = procedure.key === "rri" ? "emanata" : "pubblicata"
      setState(draft, final, procedure.states.find((state) => state.key === final)?.label ?? final)
    }
  }

  function emanationSteps(draft: StoredDraft): Emanation["steps"] {
    const started = draft.emanation?.startedAt ?? Date.now()
    const done = isFinal(draft.state)
    const document = documentOf(draft.documentKey)
    const documento = document.procedureKey === "documento"
    const keys = ["pr", "checks", "merge", "tag", "release", "email", "telegram"] as const
    return keys.map((key, index) => {
      // A documento notifies nobody; a private one never leaves the backend, so every step is skipped.
      if ((documento && (key === "email" || key === "telegram")) || document.storage === "private")
        return { key, state: "skipped" as const, url: null, at: null, detail: null }
      const finishedAt = started + (index + 1) * STEP_MS
      const state =
        done || Date.now() >= finishedAt ? "done" : Date.now() >= finishedAt - STEP_MS ? "running" : "pending"
      const tag =
        store().versions.find((version) => version.id === draft.versionId)?.tag ??
        `${document.tagPrefix}${nextLabel(document)}`
      const url =
        state === "pending"
          ? null
          : key === "pr" || key === "checks" || key === "merge"
            ? `${REPOSITORY}/pull/42`
            : (key === "tag" || key === "release") && tag
              ? `${REPOSITORY}/releases/tag/${tag}`
              : null
      const detail =
        state !== "running"
          ? key === "email" && state === "done"
            ? "Inviata a soci@polinetwork.org"
            : key === "telegram" && state === "done"
              ? "Pubblicato nel gruppo Soci"
              : null
          : key === "checks"
            ? "In attesa della CI di GitHub"
            : key === "release"
              ? "In attesa della release con il PDF"
              : null
      return { key, state, url, at: state === "done" ? new Date(finishedAt).toISOString() : null, detail }
    })
  }

  function diffOf(draft: StoredDraft): Diff {
    const base: Diff = {
      status: "none",
      generation: 0,
      generatedAt: null,
      generatedBy: null,
      provider: null,
      model: null,
      error: null,
      baseLabel: draft.base.kind === "version" ? draft.base.label : draft.base.title,
      categories: [],
      articles: [],
      otherChanges: [],
      locked: draft.notifiedAt !== null,
    }
    if (!draft.diff) return base
    if (Date.now() - draft.diff.requestedAt < DIFF_DELAY_MS)
      return { ...base, status: "pending", generation: draft.diff.generation }
    const articles = articleChanges(draft.baseFiles, draft.files)
    const byRegolamento = new Map<string, ArticleChange[]>()
    for (const article of articles) {
      const group = (article.newLabel ?? article.oldLabel ?? "").split(" › ")[0]
      byRegolamento.set(group, [...(byRegolamento.get(group) ?? []), article])
    }
    return {
      ...base,
      status: "ready",
      generation: draft.diff.generation,
      generatedAt: new Date(draft.diff.requestedAt + DIFF_DELAY_MS).toISOString(),
      generatedBy: draft.diff.by,
      provider: "fake",
      model: "deterministic",
      categories: [...byRegolamento].map(([title, changed]) => ({
        title: `Modifiche al ${title}`,
        summary: changed
          .map((article) =>
            article.kind === "added"
              ? `aggiunto l'${article.newLabel?.split(" › ")[1]}`
              : article.kind === "removed"
                ? `abrogato l'${article.oldLabel?.split(" › ")[1]}`
                : `modificato l'${article.newLabel?.split(" › ")[1]}`
          )
          .join("; ")
          .replace(/^./, (first) => first.toUpperCase())
          .concat("."),
        articleIds: changed.map((article) => article.id),
      })),
      articles,
      otherChanges:
        draft.baseFiles[ENTRY_FILE] === draft.files[ENTRY_FILE] ? [] : ["Modificato il preambolo del documento."],
    }
  }

  return {
    async getMe() {
      const drafts = store().drafts.filter(
        (draft) => !draft.deleted && draft.assignments.some((assignment) => assignment.user.id === me.id)
      )
      return {
        assignedDrafts: drafts.length,
        deleghe: store().deleghe.filter((delega) => delega.active && delega.grantee.id === me.id).length,
        // Rettifiche exist only in the rri procedure.
        rectifiable: store()
          .documents.filter(
            (document) => document.procedureKey === "rri" && document.status === "active" && mayRectify(document.key)
          )
          .map((document) => {
            const [latest] = versionsOf(document.key)
            return {
              documentKey: document.key,
              title: document.title,
              latestVersionId: latest?.id ?? null,
              latestVersionLabel: latest?.label ?? null,
            }
          }),
        permissions: {
          read: can("regulations:read"),
          write: can("regulations:write"),
          manage: can("regulations:manage"),
          rectify: can("regulations:rectify"),
        },
      }
    },
    async listDocuments() {
      if (!can("regulations:read")) refuse("Missing permission")
      activateCreated()
      return store().documents.map(documentInfo)
    },
    async getDocument({ documentKey }) {
      if (!can("regulations:read")) refuse("Missing permission")
      return documentInfo(documentOf(documentKey))
    },
    async syncDocuments(): Promise<SyncResult> {
      if (!can("regulations:manage")) refuse("Missing permission")
      activateCreated()
      // The sample repository hasn't changed since the first import; one manifest entry clashes with a private key.
      return {
        documents: store()
          .documents.filter((document) => document.storage === "repo" && document.status === "active")
          .map((document) => document.key),
        imported: [],
        updated: [],
        skipped: [{ key: "bilancio-consuntivo-2025", reason: "La chiave è già di un documento privato." }],
      }
    },
    async listTemplates() {
      if (!can("regulations:read")) refuse("Missing permission")
      return TEMPLATES
    },
    async createDocument({ key, title, template, storage }) {
      if (!can("regulations:manage")) refuse("Solo Presidente e Segretario creano documenti.")
      if (!TEMPLATES.some((candidate) => candidate.key === template))
        refuse(`Il modello «${template}» non esiste in documents.json.`)
      const replaces = checkNewKey(key, storage)
      const kind: DocumentKind =
        storage === "private" ? "privato" : template === "regolamento" ? "regolamento" : "generale"
      const skeleton = skeletonFiles(template, title, key, today())
      const document: StoredDocument = {
        key,
        title,
        kind,
        storage,
        origin: "latex",
        template,
        procedureKey: "documento",
        status: storage === "repo" ? "creating" : "active",
        creation:
          storage === "repo"
            ? {
                prNumber: 59 + store().documents.filter((candidate) => candidate.creation).length,
                prUrl: `${REPOSITORY}/pull/${59 + store().documents.filter((candidate) => candidate.creation).length}`,
                error: null,
                startedAt: now(),
                startedBy: me,
              }
            : null,
        tagPrefix: `${key}-`,
        entry: skeleton.entry,
        activateAt: storage === "repo" ? Date.now() + CREATION_MS : null,
      }
      store().documents = [...store().documents.filter((candidate) => candidate !== replaces), document]
      if (storage === "private")
        store().versions.unshift({
          id: newId(),
          documentKey: key,
          tag: null,
          label: "Modello",
          origin: "template",
          delibera: null,
          publishedAt: now(),
          releaseUrl: null,
          pdfAvailable: true,
          draftId: null,
          files: skeleton.files,
          entry: skeleton.entry,
        })
      return documentInfo(document)
    },
    async uploadDocument({ key, title, file }) {
      if (!can("regulations:manage")) refuse("Solo Presidente e Segretario caricano documenti.")
      const pdf = await readPdf(file)
      checkNewKey(key, "private")
      const document: StoredDocument = {
        key,
        title,
        kind: "privato",
        storage: "private",
        origin: "upload",
        template: null,
        procedureKey: null,
        status: "active",
        creation: null,
        tagPrefix: `${key}-`,
        entry: "",
        activateAt: null,
      }
      store().documents.push(document)
      insertUpload(document, pdf)
      return documentInfo(document)
    },
    async uploadVersion({ documentKey, file }) {
      if (!can("regulations:manage")) refuse("Solo Presidente e Segretario caricano documenti.")
      const document = documentOf(documentKey)
      if (document.origin !== "upload") refuse("Si carica una nuova versione solo dei documenti caricati come PDF.")
      return versionSummary(insertUpload(document, await readPdf(file)))
    },
    async listVersions({ documentKey }) {
      if (!can("regulations:read")) refuse("Missing permission")
      return versionsOf(documentKey).map(versionSummary)
    },
    async versionPdf({ versionId }) {
      if (!can("regulations:read")) refuse("Missing permission")
      const version =
        store().versions.find((candidate) => candidate.id === versionId) ?? refuse("Versione non trovata.")
      const pdf =
        version.pdf ?? (await (await collab()).compileOnce(`version-${version.id}`, version.entry, version.files))
      return {
        fileName: `${version.documentKey}-${(version.tag ?? version.label).replace(/[^\w.-]+/g, "_")}.pdf`,
        contentType: "application/pdf",
        base64: pdf.toString("base64"),
      }
    },
    async listDrafts({ documentKey, includeClosed }) {
      return store()
        .drafts.filter(
          (draft) =>
            !draft.deleted &&
            (documentKey === undefined || draft.documentKey === documentKey) &&
            (includeClosed || !isFinal(draft.state))
        )
        .flatMap((draft) => {
          const role = roleOf(draft)
          if (!role) return []
          settle(draft)
          return [summary(draft, role)]
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async getDraft({ draftId }) {
      const { draft, role } = visible(draftId)
      const emanationStatus = !draft.emanation
        ? "none"
        : isFinal(draft.state)
          ? "done"
          : emanationSteps(draft).some((step) => step.state === "running" && step.detail)
            ? "waiting"
            : "running"
      return {
        ...summary(draft, role),
        can: capabilities(draft, role),
        procedure: procedureOf(draft.documentKey),
        deadlines: deadlines(draft),
        delibera: draft.delibera,
        diffStatus: diffOf(draft).status,
        emanationStatus,
        versionId: draft.versionId,
        approvedAt: draft.approvedAt,
        emanatedAt: draft.emanatedAt,
        notifiedAt: draft.notifiedAt,
      }
    },
    async draftFiles({ draftId }) {
      const { draft } = visible(draftId)
      return { files: draft.files, structure: draftStructure(draft), sources: sourcesOf(draft.documentKey) }
    },
    async createDraft({ documentKey, title, from, kind = "modifica", secret = false }) {
      const document = documentOf(documentKey)
      const blocked = notEditableReason(document)
      if (blocked) refuse(blocked)
      if (kind === "rettifica" && document.procedureKey !== "rri")
        refuse("La rettifica esiste solo per i documenti con la procedura dei regolamenti (RRI).")
      if (kind === "rettifica" ? !mayRectify(documentKey) : !can("regulations:write")) refuse("Missing permission")
      const source =
        from.kind === "version"
          ? store().versions.find((version) => version.id === from.id && version.documentKey === documentKey)
          : store().drafts.find(
              (draft) => draft.id === from.id && !draft.deleted && draft.documentKey === documentKey && roleOf(draft)
            )
      if (!source) return refuse("La base scelta non esiste.")
      const [latest] = versionsOf(documentKey)
      if (kind === "rettifica" && from.id !== latest?.id) refuse("Una rettifica parte dall'ultima versione emanata.")
      const id = newId()
      const created: StoredDraft = {
        id,
        documentKey,
        title,
        kind,
        state: "bozza",
        base:
          from.kind === "version"
            ? { kind: "version", id: from.id, label: "label" in source ? source.label : from.id }
            : { kind: "draft", id: from.id, title: "title" in source ? source.title : from.id },
        // A draft from a secret draft would show its text: it is secret too.
        secret: secret || ("secret" in source && source.secret),
        createdBy: me,
        createdAt: now(),
        updatedAt: now(),
        stateChangedAt: now(),
        deleted: false,
        entry: document.entry,
        files: source.files,
        baseFiles: source.files,
        assignments: [{ user: me, role: "editor", assignedBy: me, assignedAt: now() }],
        comments: [],
        seedComments: [],
        snapshots: [],
        delibera: null,
        approvedAt: null,
        emanatedAt: null,
        notifiedAt: null,
        versionId: null,
        diff: null,
        emanation: null,
        lastActivity: 0,
      }
      created.snapshots.push({
        id: newId(),
        draftId: id,
        kind: "base",
        name: `Creata da ${created.base.kind === "version" ? created.base.label : created.base.title}`,
        createdAt: now(),
        createdBy: me,
        files: source.files,
      })
      store().drafts.unshift(created)
      return { id }
    },
    async renameDraft({ draftId, title }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).rename) refuse("Non puoi rinominare questa bozza.")
      draft.title = title
    },
    async revealDraft({ draftId }) {
      const { draft } = visible(draftId)
      if (!draft.secret) refuse("La bozza è già visibile.")
      if (!isCreator(draft)) refuse("Solo chi ha creato la bozza segreta la rende visibile.")
      draft.secret = false
      draft.updatedAt = now()
    },
    async deleteDraft({ draftId }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).delete) refuse("Solo una bozza può essere eliminata.")
      draft.deleted = true
    },
    async transition({ draftId, to, delibera }) {
      const { draft, role } = visible(draftId)
      const option = capabilities(draft, role).transitions.find((transition) => transition.to === to)
      if (!option) return refuse("Questo passaggio non è disponibile.")
      if (option.blockedBy) refuse(option.blockedBy)
      if (to === "approvata") {
        if (!delibera) return refuse("Serve la delibera per registrare l'approvazione.")
        draft.delibera = {
          kind: "approvazione",
          body: delibera.body,
          date: delibera.date,
          verbaleUrl: delibera.verbaleUrl ?? null,
          recordedBy: me,
          recordedAt: now(),
        }
        draft.approvedAt = now()
      }
      if (to === "in_approvazione") draft.diff = { generation: 1, requestedAt: Date.now(), by: null }
      if (to === "bozza") {
        draft.diff = null
        draft.delibera = null
        draft.approvedAt = null
      }
      setState(draft, to, procedureOf(draft.documentKey).states.find((state) => state.key === to)?.label ?? to)
    },
    async listAssignments({ draftId }) {
      return visible(draftId).draft.assignments
    },
    async setAssignment({ draftId, userId, role: assigned }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).assign) refuse("Non puoi assegnare questa bozza.")
      if (draft.secret && userId === draft.createdBy.id) refuse(CREATOR_STAYS)
      const target = [...FAKE_USERS, { id: AGENT_ID, name: "Preview Agent", email: "agent@polinetwork.org" }].find(
        (candidate) => candidate.id === userId
      )
      if (!target) return refuse("Account non trovato.")
      const existing = draft.assignments.find((assignment) => assignment.user.id === userId)
      if (existing) existing.role = assigned
      else draft.assignments.push({ user: target, role: assigned, assignedBy: me, assignedAt: now() })
    },
    async removeAssignment({ draftId, userId }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).assign) refuse("Non puoi assegnare questa bozza.")
      if (draft.secret && userId === draft.createdBy.id) refuse(CREATOR_STAYS)
      draft.assignments = draft.assignments.filter((assignment) => assignment.user.id !== userId)
    },
    async searchUsers({ q }) {
      const needle = q.trim().toLocaleLowerCase()
      return [...FAKE_USERS, { id: AGENT_ID, name: "Preview Agent", email: "agent@polinetwork.org" }].filter(
        (candidate) =>
          candidate.name.toLocaleLowerCase().includes(needle) || candidate.email?.toLocaleLowerCase().includes(needle)
      )
    },
    async collabTicket({ draftId }) {
      const { draft, role } = visible(draftId)
      const readOnly = !capabilities(draft, role).edit
      const service = await collab()
      const { ticket, expiresAt } = service.issueTicket(draftId, role, readOnly)
      return { url: service.url, documentName: draftId, ticket, role, readOnly, expiresAt }
    },
    async compileStatus({ draftId }) {
      visible(draftId)
      return (await collab()).compileStatus(draftId)
    },
    async compilePdf({ draftId, hash }) {
      const { draft } = visible(draftId)
      const pdf = (await collab()).pdf(draftId, hash) ?? refuse("PDF non trovato.")
      return { fileName: `${draft.title}.pdf`, contentType: "application/pdf", base64: pdf.toString("base64") }
    },
    async listSnapshots({ draftId }) {
      return visible(draftId)
        .draft.snapshots.map(({ files, ...snapshot }) => (void files, snapshot))
        .reverse()
    },
    async getSnapshot({ snapshotId }) {
      const draft = store().drafts.find((candidate) => candidate.snapshots.some((s) => s.id === snapshotId))
      if (!draft) return refuse("Versione della cronologia non trovata.")
      visible(draft.id)
      return draft.snapshots.find((snapshot) => snapshot.id === snapshotId)!
    },
    async createSnapshot({ draftId, name }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).snapshot) refuse("Non puoi salvare versioni di questa bozza.")
      draft.snapshots.push({
        id: newId(),
        draftId,
        kind: "named",
        name,
        createdAt: now(),
        createdBy: me,
        files: draft.files,
      })
    },
    async restoreSnapshot({ snapshotId }) {
      const draft = store().drafts.find((candidate) => candidate.snapshots.some((s) => s.id === snapshotId))
      if (!draft) return refuse("Versione della cronologia non trovata.")
      const { role } = visible(draft.id)
      if (!capabilities(draft, role).restore) refuse("Non puoi ripristinare questa bozza ora.")
      const snapshot = draft.snapshots.find((candidate) => candidate.id === snapshotId)!
      const label = snapshot.name ?? new Date(snapshot.createdAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })
      await (await collab()).replaceFiles(draft.id, snapshot.files)
      draft.files = snapshot.files
      draft.snapshots.push({
        id: newId(),
        draftId: draft.id,
        kind: "restore",
        name: `Ripristinata: ${label}`,
        createdAt: now(),
        createdBy: me,
        files: snapshot.files,
      })
    },
    async listComments({ draftId }) {
      return visible(draftId).draft.comments
    },
    async createComment({ draftId, anchor, quote, body }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).comment) refuse("Non puoi commentare questa bozza.")
      draft.comments.push({
        id: newId(),
        draftId,
        body,
        author: me,
        createdAt: now(),
        editedAt: null,
        deleted: false,
        anchor,
        quote,
        resolvedAt: null,
        resolvedBy: null,
        replies: [],
      })
    },
    async replyComment({ commentId, body }) {
      const { thread, draft, role } = commentThread(commentId)
      if (!capabilities(draft, role).comment) refuse("Non puoi commentare questa bozza.")
      thread.replies.push({ id: newId(), body, author: me, createdAt: now(), editedAt: null, deleted: false })
    },
    async resolveComment({ commentId }) {
      const { thread, draft, role } = commentThread(commentId)
      if (!capabilities(draft, role).comment) refuse("Non puoi commentare questa bozza.")
      thread.resolvedAt = now()
      thread.resolvedBy = me
    },
    async reopenComment({ commentId }) {
      const { thread, draft, role } = commentThread(commentId)
      if (!capabilities(draft, role).comment) refuse("Non puoi commentare questa bozza.")
      thread.resolvedAt = null
      thread.resolvedBy = null
    },
    async deleteComment({ commentId }) {
      const { draft } = commentThread(commentId)
      const thread = draft.comments.find((candidate) => candidate.id === commentId)
      if (thread) {
        if (thread.author.id !== me.id && !can("regulations:write")) refuse("Puoi eliminare solo i tuoi commenti.")
        draft.comments = draft.comments.filter((candidate) => candidate.id !== commentId)
        return
      }
      for (const parent of draft.comments) {
        const reply = parent.replies.find((candidate) => candidate.id === commentId)
        if (!reply) continue
        if (reply.author.id !== me.id && !can("regulations:write")) refuse("Puoi eliminare solo i tuoi commenti.")
        Object.assign(reply, { deleted: true, body: "" })
      }
    },
    async previewMerge({ targetDraftId, source }) {
      return mergePlan(targetDraftId, source).preview
    },
    async applyMerge({ targetDraftId, source, resolutions }) {
      const plan = mergePlan(targetDraftId, source)
      if (plan.preview.blockedBy) refuse(plan.preview.blockedBy)
      for (const conflict of plan.preview.conflicts)
        if (!(conflict.nodeId in resolutions)) refuse(`Manca la scelta per ${conflict.label}.`)
      const merged = applyPlan(plan, resolutions)
      const target = plan.target
      target.snapshots.push({
        id: newId(),
        draftId: target.id,
        kind: "merge",
        name: `Prima dell'unione di ${plan.sourceLabel}`,
        createdAt: now(),
        createdBy: me,
        files: target.files,
      })
      await (await collab()).replaceFiles(target.id, merged)
      target.files = merged
    },
    async getDiff({ draftId }) {
      return diffOf(visible(draftId).draft)
    },
    async regenerateDiff({ draftId }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).regenerateDiff) refuse("Il diff non può più essere rigenerato.")
      draft.diff = { generation: (draft.diff?.generation ?? 0) + 1, requestedAt: Date.now(), by: me }
    },
    async diffPdf({ draftId }) {
      // The backend typesets the differences; here the draft's own text stands in, so the viewer has a real PDF.
      const { draft } = visible(draftId)
      const pdf = await (await collab()).compileOnce(`diff-${draft.id}`, ENTRY_FILE, draft.files)
      return {
        fileName: `${draft.title} - differenze.pdf`,
        contentType: "application/pdf",
        base64: pdf.toString("base64"),
      }
    },
    async getEmanation({ draftId }) {
      const { draft } = visible(draftId)
      if (!draft.emanation) return null
      const steps = emanationSteps(draft)
      const done = isFinal(draft.state)
      return {
        draftId,
        status: done ? "done" : steps.some((step) => step.state === "running" && step.detail) ? "waiting" : "running",
        tag: steps[3].state === "done" ? (store().versions.find((v) => v.id === draft.versionId)?.tag ?? null) : null,
        steps,
        startedAt: new Date(draft.emanation.startedAt).toISOString(),
        startedBy: draft.emanation.startedBy,
        finishedAt: draft.emanatedAt,
        notifications: steps
          .flatMap((step) =>
            (step.key === "email" || step.key === "telegram") && step.state === "done"
              ? [{ ...step, key: step.key }]
              : []
          )
          .map((step) => ({
            channel: step.key,
            kind: "emanazione",
            recipients: step.key === "email" ? ["soci@polinetwork.org"] : ["Gruppo Soci"],
            status: "sent" as const,
            sentAt: step.at,
            error: null,
          })),
      }
    },
    async startEmanation({ draftId }) {
      const { draft, role } = visible(draftId)
      if (!capabilities(draft, role).emanate) refuse("Questa bozza non può essere emanata ora.")
      const delega = draft.kind === "rettifica" && !can("regulations:rectify") ? delegaFor(draft.documentKey) : null
      if (draft.kind === "rettifica")
        draft.delibera = {
          kind: "rettifica",
          date: today(),
          rectifiedBy: me,
          onBehalfOf: delega ? delega.grantedBy : null,
          delegaId: delega?.id ?? null,
        }
      draft.emanation = { startedAt: Date.now(), startedBy: me, delegaId: delega?.id ?? null }
      // A private documento is published at once (every step skipped).
      settle(draft)
      void collab().then((service) => service.notifyState(draft.id, draft.state))
    },
    async retryEmanation() {},
    async listDeleghe() {
      return store().deleghe.filter((delega) => can("regulations:rectify") || delega.grantee.id === me.id)
    },
    async createDelega({ userId, documentKey, expiresAt, note }) {
      if (!can("regulations:rectify")) refuse("Missing permission")
      const grantee = [...FAKE_USERS, { id: AGENT_ID, name: "Preview Agent", email: "agent@polinetwork.org" }].find(
        (candidate) => candidate.id === userId
      )
      if (!grantee) return refuse("Account non trovato.")
      store().deleghe.unshift({
        id: newId(),
        grantee,
        documentKey: documentKey ?? null,
        expiresAt: expiresAt ?? null,
        note: note ?? null,
        grantedBy: me,
        createdAt: now(),
        revokedAt: null,
        revokedBy: null,
        active: true,
      })
      console.info(`[regulations fake] Email a direttivo@polinetwork.org: delega di rettifica a ${grantee.name}.`)
    },
    async revokeDelega({ delegaId }) {
      if (!can("regulations:rectify")) refuse("Missing permission")
      const delega = store().deleghe.find((candidate) => candidate.id === delegaId) ?? refuse("Delega non trovata.")
      Object.assign(delega, { active: false, revokedAt: now(), revokedBy: me })
      console.info(`[regulations fake] Email a direttivo@polinetwork.org: revocata la delega a ${delega.grantee.name}.`)
    },
  }

  function commentThread(commentId: string) {
    for (const draft of store().drafts) {
      const thread = draft.comments.find(
        (candidate) => candidate.id === commentId || candidate.replies.some((reply) => reply.id === commentId)
      )
      if (thread) {
        const { role } = visible(draft.id)
        return { draft, thread, role }
      }
    }
    return refuse("Commento non trovato.")
  }

  function documentInfo(document: StoredDocument): DocumentInfo {
    const drafts = store().drafts.filter((draft) => !draft.deleted && draft.documentKey === document.key)
    for (const draft of drafts) settle(draft)
    const current = drafts.find((draft) => draft.state === "in_approvazione" || draft.state === "approvata")
    const [latest] = versionsOf(document.key)
    const { entry: _entry, activateAt: _activateAt, ...info } = document
    return {
      ...info,
      procedure: document.procedureKey ? PROCEDURES[document.procedureKey] : null,
      editable: notEditableReason(document) === null,
      latestVersion: latest ? versionSummary(latest) : null,
      openDrafts: drafts.filter((draft) => !draft.secret && !isFinal(draft.state)).length,
      inApproval: current ? { id: current.id, title: current.title } : null,
    }
  }

  type Unit = {
    id: string
    kind: FileNode["kind"]
    file: string
    label: string
    from: number
    to: number
    text: string
    parentId: string | null
    previousId: string | null
    /** Where the whole node ends (an article with its commi). */
    end: number
  }

  /** Comma-sized units: a comma's text, an article's heading and body before its commi; ids from the text. */
  function units(files: Files) {
    const result = new Map<string, Unit>()
    const nodes = parse(files).nodes
    const lastChild = new Map<string | null, string>()
    for (const [index, node] of nodes.entries()) {
      if (!node.id || (node.kind !== "articolo" && node.kind !== "comma")) continue
      const text = files[node.file] ?? ""
      const parent =
        node.kind === "comma" ? nodes.findLast((other, at) => at < index && other.kind === "articolo") : null
      const firstChild = nodes.find(
        (other, at) => at > index && other.file === node.file && other.from < node.to && other.kind === "comma"
      )
      const end = node.kind === "articolo" && firstChild ? text.lastIndexOf("\\begin{commi}", firstChild.from) : node.to
      const parentId = parent?.id ?? null
      result.set(node.id, {
        id: node.id,
        kind: node.kind,
        file: node.file,
        label: node.path,
        from: node.from,
        to: end,
        text: text.slice(node.from, end).trimEnd(),
        parentId,
        previousId: lastChild.get(parentId) ?? null,
        end: node.to,
      })
      lastChild.set(parentId, node.id)
    }
    return result
  }

  function mergePlan(targetDraftId: string, source: { kind: "draft" | "version"; id: string }) {
    const { draft: target, role } = visible(targetDraftId)
    const theirsFiles =
      source.kind === "draft"
        ? visible(source.id).draft.files
        : (store().versions.find((version) => version.id === source.id)?.files ?? refuse("Versione non trovata."))
    const sourceLabel =
      source.kind === "draft"
        ? (store().drafts.find((draft) => draft.id === source.id)?.title ?? source.id)
        : (store().versions.find((version) => version.id === source.id)?.label ?? source.id)
    const base = units(target.baseFiles)
    const ours = units(target.files)
    const theirs = units(theirsFiles)
    const conflicts: MergeConflict[] = []
    const applied: MergePreview["applied"] = []
    for (const id of new Set([...base.keys(), ...ours.keys(), ...theirs.keys()])) {
      const b = base.get(id)?.text ?? null
      const o = ours.get(id)?.text ?? null
      const t = theirs.get(id)?.text ?? null
      if (o === t || t === b) continue
      const unit = (ours.get(id) ?? theirs.get(id) ?? base.get(id))!
      if (o === b) {
        if (unit.kind === "comma" && unit.parentId && !ours.has(unit.parentId) && !base.has(unit.parentId)) continue
        applied.push({
          nodeId: id,
          label: unit.label,
          change: b === null ? "added" : t === null ? "removed" : "modified",
        })
        continue
      }
      conflicts.push({
        nodeId: id,
        kind: unit.kind,
        label: unit.label,
        file: unit.file,
        type:
          b === null
            ? "both_added"
            : t === null
              ? "modified_deleted"
              : o === null
                ? "deleted_modified"
                : "both_modified",
        base: b,
        ours: o,
        theirs: t,
      })
    }
    const blockedBy = !capabilities(target, role).merge
      ? "Si può unire solo in una bozza che puoi modificare."
      : !structureOf(target.files, target.entry).parses
        ? "Il testo di questa bozza non è valido: correggi gli errori prima di unire."
        : !structureOf(theirsFiles, target.entry).parses
          ? `Il testo di ${sourceLabel} non è valido: va corretto prima di unirlo.`
          : null
    return {
      target,
      sourceLabel,
      ours,
      theirs,
      theirsFiles,
      preview: {
        blockedBy,
        baseLabel: target.base.kind === "version" ? target.base.label : target.base.title,
        conflicts,
        applied,
        warnings: [],
      } satisfies MergePreview,
    }
  }

  function applyPlan(
    plan: ReturnType<typeof mergePlan>,
    resolutions: Record<string, "ours" | "theirs" | { text: string }>
  ) {
    const files = { ...plan.target.files }
    type Edit = { file: string; from: number; to: number; text: string }
    const edits: Edit[] = []
    const take = (id: string, text: string | null) => {
      const mine = plan.ours.get(id)
      if (mine) {
        edits.push({ file: mine.file, from: mine.from, to: mine.from + mine.text.length, text: text ?? "" })
        return
      }
      if (text === null) return
      const theirs = plan.theirs.get(id)!
      const anchor = theirs.previousId ? plan.ours.get(theirs.previousId) : null
      const whole =
        theirs.kind === "articolo" ? plan.theirsFiles[theirs.file].slice(theirs.from, theirs.end).trimEnd() : text
      if (anchor) {
        const end = anchor.kind === "articolo" ? anchor.end : anchor.from + anchor.text.length
        edits.push({
          file: anchor.file,
          from: end,
          to: end,
          text: `${anchor.kind === "articolo" ? "\n\n" : "\n  "}${whole}`,
        })
      } else
        edits.push({
          file: theirs.file,
          from: files[theirs.file]?.length ?? 0,
          to: files[theirs.file]?.length ?? 0,
          text: `\n${whole}\n`,
        })
    }
    for (const change of plan.preview.applied) {
      const unit = plan.theirs.get(change.nodeId)
      if (change.change === "added" && unit?.kind === "comma" && unit.parentId && !plan.ours.has(unit.parentId))
        continue
      take(change.nodeId, unit?.text ?? null)
    }
    for (const conflict of plan.preview.conflicts) {
      const choice = resolutions[conflict.nodeId]
      if (choice === "ours") continue
      take(conflict.nodeId, choice === "theirs" ? conflict.theirs : choice.text)
    }
    for (const edit of edits.sort((a, b) => b.from - a.from)) {
      const text = files[edit.file] ?? ""
      files[edit.file] = text.slice(0, edit.from) + edit.text + text.slice(edit.to)
    }
    return files
  }
}

/** Article by article, base → draft: what the backend's structural diff reports, with word-level changes. */
function articleChanges(before: Files, after: Files): ArticleChange[] {
  const articles = (files: Files) => {
    const result = new Map<string, { label: string; text: string; number: string; order: number }>()
    const { nodes } = parse(files)
    const numbers = new Map(nodes.flatMap((node) => (node.id ? [[node.id, node.number] as const] : [])))
    for (const [order, node] of nodes.entries()) {
      if (node.kind !== "articolo" || !node.id) continue
      const regolamento = nodes.findLast((other, at) => at < order && other.kind === "regolamento")
      const body = (files[node.file] ?? "").slice(node.headTo, node.to)
      result.set(node.id, {
        label: `${regolamento ? `${plainTitle(regolamento.title ?? "")} › ` : ""}Articolo ${node.number} — ${node.title}`,
        text: plainBody(body, numbers),
        number: node.number,
        order,
      })
    }
    return result
  }
  const old = articles(before)
  const current = articles(after)
  const changes: ArticleChange[] = []
  for (const id of new Set([...current.keys(), ...old.keys()])) {
    const a = old.get(id)
    const b = current.get(id)
    if (a && b && a.text === b.text && a.label === b.label) continue
    const kind = !a
      ? "added"
      : !b
        ? "removed"
        : a.text === b.text
          ? a.number === b.number
            ? "modified"
            : "renumbered"
          : "modified"
    changes.push({
      id,
      kind,
      oldLabel: a?.label ?? null,
      newLabel: b?.label ?? null,
      oldText: a?.text ?? null,
      newText: b?.text ?? null,
      words:
        a && b
          ? diffWords(a.text, b.text).map((part) => ({
              op: part.added ? ("insert" as const) : part.removed ? ("delete" as const) : ("equal" as const),
              text: part.value,
            }))
          : [],
      moved: null,
    })
  }
  return changes.sort(
    (x, y) => (current.get(x.id)?.order ?? old.get(x.id)!.order) - (current.get(y.id)?.order ?? old.get(y.id)!.order)
  )
}

/** LaTeX to the plain text the diff shows: commi as numbered paragraphs, lettere as "a)". */
function plainBody(latex: string, numbers: ReadonlyMap<string, string>) {
  let comma = 0
  let lettera = 0
  return latex
    .replace(/%.*$/gm, "")
    .replace(/\\begin\{commi\}/g, () => {
      comma = 0
      return ""
    })
    .replace(/\\begin\{lettere\}/g, () => {
      lettera = 0
      return ""
    })
    .replace(/\\(begin|end)\{(commi|lettere|elenco)\}/g, "")
    .replace(/\\comma(\[[^\]]*\])?/g, () => `\n${++comma}. `)
    .replace(/\\lettera(\[[^\]]*\])?/g, () => `\n   (${String.fromCharCode(96 + ++lettera)}) `)
    .replace(/\\voce/g, "\n   • ")
    .replace(/\\rif\{([^}]*)\}/g, (_, id: string) => numbers.get(id) ?? "?")
    .replace(/\\(textbf|emph|textit|underline|url)\{([^{}]*)\}/g, "$2")
    .replace(/\\href\{[^{}]*\}\{([^{}]*)\}/g, "$1")
    .replace(/~/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

/** Refusals throw with the Italian message the page shows, as the backend's do. */
export function fakeRegulationsApi(viewer: RegulationsViewer): RegulationsApi {
  return api(viewer)
}
