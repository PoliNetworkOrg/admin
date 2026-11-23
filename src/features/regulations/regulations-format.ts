import {
  type Delibera,
  type DocumentKind,
  type DraftKind,
  type DraftRole,
  FINAL_STATES,
  type Procedure,
  type StateKey,
  type VersionSummary,
} from "./regulations.contract"

/**
 * Regolamenti speak Italian: dates as the documents print them ("12/03/2026"), times in Europe/Rome, and the
 * procedure's own words. Formatters fix the zone so server and browser render the same text.
 */

const ROME = "Europe/Rome"
const day = new Intl.DateTimeFormat("it-IT", { timeZone: ROME, day: "2-digit", month: "2-digit", year: "numeric" })
const dayTime = new Intl.DateTimeFormat("it-IT", {
  timeZone: ROME,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
const longDay = new Intl.DateTimeFormat("it-IT", { timeZone: ROME, day: "numeric", month: "long", year: "numeric" })

/** "12/03/2026", from a timestamp or a `YYYY-MM-DD` date (a calendar day, never shifted by the zone). */
export function formatDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, date] = value.split("-")
    return `${date}/${month}/${year}`
  }
  return day.format(new Date(value))
}

/** "12/03/2026, 21:30". */
export function formatDayTime(value: string) {
  return dayTime.format(new Date(value))
}

/** "12 marzo 2026". */
export function formatLongDay(value: string) {
  return longDay.format(/^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value))
}

/** Today in Europe/Rome, `YYYY-MM-DD`. */
export function todayInRome() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ROME }).format(new Date())
}

export const STATE_TONES = {
  bozza: "warning",
  in_approvazione: "brand",
  approvata: "success",
  emanata: "neutral",
  pubblicata: "neutral",
} as const satisfies Record<StateKey, "warning" | "brand" | "success" | "neutral">

/** Labels when the draft's own procedure isn't at hand (lists). */
export const STATE_LABELS = {
  bozza: "Bozza",
  in_approvazione: "In approvazione",
  approvata: "Approvata",
  emanata: "Emanata",
  pubblicata: "Pubblicata",
} as const satisfies Record<StateKey, string>

export const KIND_LABELS = { modifica: "Modifica", rettifica: "Rettifica" } as const satisfies Record<DraftKind, string>

export const ROLE_LABELS = {
  editor: "Può modificare",
  commenter: "Può commentare",
  viewer: "Può leggere",
} as const satisfies Record<DraftRole, string>

export const BODY_LABELS = { consiglio_direttivo: "Consiglio Direttivo", assemblea: "Assemblea dei Soci" } as const

/** As the document prints it: "Approvato dal Consiglio Direttivo il 12/03/2026", "Rettificato da X su delega del Segretario il …". */
export function deliberaLine(delibera: Delibera) {
  if (delibera.kind === "approvazione")
    return `Approvato ${delibera.body === "assemblea" ? "dall'Assemblea dei Soci" : "dal Consiglio Direttivo"} il ${formatDay(delibera.date)}`
  return `Rettificato da ${delibera.rectifiedBy.name}${delibera.onBehalfOf ? " su delega del Segretario" : ""} il ${formatDay(delibera.date)}`
}

/** Where a version comes from, in one line: the delibera when it has one. */
export function versionOrigin(version: VersionSummary) {
  if (version.delibera) return deliberaLine(version.delibera)
  return {
    import: "Importata dal repository",
    draft: "Pubblicata da una bozza",
    template: "Testo iniziale dal modello",
    upload: "PDF caricato",
  }[version.origin]
}

/** A closed draft: emanated (`rri`) or published (`documento`), a version now. */
export function isFinalState(state: StateKey) {
  return FINAL_STATES.some((final) => final === state)
}

/**
 * The procedure's own words for the step that publishes a draft of this kind: "Emana e notifica", "Emana rettifica",
 * "Pubblica".
 */
export function finalStepLabel(procedure: Procedure, kind: DraftKind) {
  return (
    procedure.transitions.find((transition) => transition.kinds.includes(kind) && isFinalState(transition.to))?.label ??
    "Emana e notifica"
  )
}

/** Documenti's sections, in this order. */
export const DOCUMENT_KIND_LABELS = {
  regolamento: "Regolamenti",
  generale: "Documenti generali",
  privato: "Privati",
  consultazione: "Sola consultazione",
} as const satisfies Record<DocumentKind, string>

export function baseLabel(base: { kind: "version"; label: string } | { kind: "draft"; title: string }) {
  return base.kind === "version" ? `Versione ${base.label}` : `Bozza «${base.title}»`
}
