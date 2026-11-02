import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  autocompletion,
} from "@codemirror/autocomplete"
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language"
import { stex } from "@codemirror/legacy-modes/mode/stex"
import { type Extension, RangeSetBuilder } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view"
import { tags } from "@lezer/highlight"

import { idsIn, newNodeId, type StructureNode } from "../latex-structure"

/**
 * Source mode: LaTeX highlighting (CodeMirror's `stex` mode), the grammar's macros set apart, the system's ids
 * dimmed, and completions that insert macros with a fresh id and `\rif` targets by their reference.
 */

const latexHighlight = HighlightStyle.define([
  { tag: tags.tagName, color: "var(--pn-accent)" },
  { tag: tags.keyword, color: "var(--pn-accent)" },
  { tag: [tags.bracket, tags.squareBracket, tags.brace], color: "var(--pn-fg-muted)" },
  { tag: tags.comment, color: "var(--pn-fg-subtle)", fontStyle: "italic" },
  { tag: [tags.atom, tags.number], color: "var(--pn-success-fg)" },
  { tag: [tags.string, tags.special(tags.variableName), tags.variableName], color: "var(--pn-warning-fg)" },
  { tag: tags.invalid, color: "var(--pn-danger-fg)" },
])

const STRUCTURE_COMMAND = /\\(regolamento|articolo|comma|lettera|voce)\b|\\(begin|end)\{capo\}/g
/** An options block with an id: `[id=k3x9q1]`, `[id=k3x9q1, nuovapagina]`. */
const ID_OPTION = /\[[^\]\n]*\bid\s*=[^\]\n]*\]/g

const structureMark = Decoration.mark({ class: "cm-pn-structure" })
const idMark = Decoration.mark({ class: "cm-pn-id" })

function sourceMarks(view: EditorView): DecorationSet {
  const marks: { from: number; to: number; deco: Decoration }[] = []
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    for (const match of text.matchAll(STRUCTURE_COMMAND))
      marks.push({ from: from + match.index, to: from + match.index + match[0].length, deco: structureMark })
    for (const match of text.matchAll(ID_OPTION))
      marks.push({ from: from + match.index, to: from + match.index + match[0].length, deco: idMark })
  }
  marks.sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  for (const mark of marks) builder.add(mark.from, mark.to, mark.deco)
  return builder.finish()
}

const sourceMarksPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = sourceMarks(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = sourceMarks(update.view)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

/** What completions need from the rest of the draft: every file's text (ids are unique per document) and its nodes. */
export type DraftContext = {
  allText: () => string
  /** Every node of the draft, numbered as the PDF numbers them. */
  nodes: () => StructureNode[]
  /** One file's nodes, numbered within the whole document, and the file's text they were read from. */
  nodesOf: (file: string) => { text: string; nodes: StructureNode[] }
}

type Macro = {
  label: string
  detail: string
  info?: string
  build: (id: () => string) => { text: string; cursor: number }
}

/** `text` with `|` marking where the cursor goes. */
function template(text: string) {
  const cursor = text.indexOf("|")
  return { text: text.replace("|", ""), cursor }
}

const MACROS: Macro[] = [
  {
    label: "\\regolamento",
    detail: "Regolamento",
    info: "Un regolamento della raccolta; l'id lo inserisce il sistema.",
    build: (id) => template(`\\regolamento[id=${id()}]{|}`),
  },
  {
    label: "\\begin{capo}",
    detail: "Capo",
    info: "Raggruppa articoli; i capi possono contenere altri capi.",
    build: (id) => template(`\\begin{capo}[id=${id()}]{|}\n\n\\end{capo}`),
  },
  { label: "\\articolo", detail: "Articolo", build: (id) => template(`\\articolo[id=${id()}]{|}`) },
  {
    label: "\\begin{commi}",
    detail: "Elenco di commi",
    build: (id) => template(`\\begin{commi}\n  \\comma[id=${id()}] |\n\\end{commi}`),
  },
  { label: "\\comma", detail: "Comma", build: (id) => template(`\\comma[id=${id()}] |`) },
  {
    label: "\\begin{lettere}",
    detail: "Elenco di lettere",
    build: () => template("\\begin{lettere}\n  \\lettera |\n\\end{lettere}"),
  },
  { label: "\\lettera", detail: "Lettera", build: () => template("\\lettera |") },
  {
    label: "\\begin{elenco}",
    detail: "Elenco puntato",
    build: () => template("\\begin{elenco}\n  \\voce |\n\\end{elenco}"),
  },
  { label: "\\voce", detail: "Voce di elenco", build: () => template("\\voce |") },
  {
    label: "\\rif",
    detail: "Riferimento",
    info: "Stampa il numero di un regolamento, capo, articolo o comma; le parole intorno si scrivono a mano.",
    build: () => template("\\rif{|}"),
  },
  { label: "\\textbf", detail: "Grassetto", build: () => template("\\textbf{|}") },
  { label: "\\emph", detail: "Enfasi", build: () => template("\\emph{|}") },
  { label: "\\textit", detail: "Corsivo", build: () => template("\\textit{|}") },
  { label: "\\underline", detail: "Sottolineato", build: () => template("\\underline{|}") },
  { label: "\\texttt", detail: "Monospaziato", build: () => template("\\texttt{|}") },
  { label: "\\href", detail: "Collegamento", build: () => template("\\href{|}{}") },
  { label: "\\url", detail: "Indirizzo web", build: () => template("\\url{|}") },
  { label: "\\footnote", detail: "Nota a piè di pagina", build: () => template("\\footnote{|}") },
]

function macroCompletions(context: DraftContext): Completion[] {
  return MACROS.map((macro) => ({
    label: macro.label,
    detail: macro.detail,
    info: macro.info,
    type: "keyword",
    apply: (view, _completion, from, to) => {
      // One fresh id per insertion, unique across every file of the draft (and within this insertion).
      const taken = idsIn(context.allText())
      const { text, cursor } = macro.build(() => {
        const id = newNodeId(taken)
        taken.add(id)
        return id
      })
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + cursor },
        scrollIntoView: true,
      })
    },
  }))
}

function latexCompletions(context: DraftContext) {
  return (completion: CompletionContext): CompletionResult | null => {
    const rif = completion.matchBefore(/\\rif\{[0-9a-z]*/)
    if (rif) {
      const start = rif.from + "\\rif{".length
      const options: Completion[] = context
        .nodes()
        .filter((node) => node.id !== null && node.kind !== "lettera")
        .map((node) => ({
          label: node.reference,
          apply: node.id!,
          detail: node.id!,
          info: node.path,
          type: "variable",
        }))
      return { from: start, options, validFor: /^[0-9a-z]*$/ }
    }
    const command = completion.matchBefore(/\\[a-zA-Z{]*/)
    if (!command || (command.from === command.to && !completion.explicit)) return null
    return { from: command.from, options: macroCompletions(context), validFor: /^\\[a-zA-Z{]*$/ }
  }
}

/** Shared by both modes: highlighting, completions; source mode adds the macro and id marks. */
export function latexLanguage(context: DraftContext): Extension {
  return [
    StreamLanguage.define(stex),
    syntaxHighlighting(latexHighlight),
    autocompletion({ override: [latexCompletions(context)], icons: false }),
  ]
}

export const sourceModeMarks: Extension = sourceMarksPlugin
