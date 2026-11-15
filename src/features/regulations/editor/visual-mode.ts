import type { Extension } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view"

import { parseStructure } from "../latex-structure"
import type { DraftContext } from "./latex-language"

/**
 * The visual mode (Overleaf's Visual Editor): decorations over the same LaTeX, so collaborators in either mode edit
 * one text. Headings render with their number, commi and lettere as numbered paragraphs, bold and italic as such,
 * `\rif` as the reference it prints; commands and the system's ids are hidden and the cursor steps over them.
 */

class LabelWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly className: string
  ) {
    super()
  }
  eq(other: LabelWidget) {
    return other.text === this.text && other.className === this.className
  }
  toDOM() {
    const span = document.createElement("span")
    span.className = this.className
    span.textContent = this.text
    return span
  }
  ignoreEvent() {
    return false
  }
}

type Range = { from: number; to: number; deco: Decoration }

const hidden = Decoration.replace({})
/** The entry file's front matter and closing: free LaTeX, shown as source. */
const PREAMBLE =
  /^\s*\\(documentclass|usepackage|intestazione|approvazione|rettifica|delibera|begin\{document\}|end\{document\}|tableofcontents|input)\b/
const INLINE = /\\(textbf|emph|textit|underline|texttt|url)\{([^{}\n]*)\}/g
const HREF = /\\href\{([^{}\n]*)\}\{([^{}\n]*)\}/g
const RIF = /\\rif\{([^{}\n]*)\}/g
/** List environments and the end of a capo: hidden lines (a capo's `\begin` is its heading). */
const ENVIRONMENT = /\\(begin|end)\{(commi|lettere|elenco)\}|\\end\{capo\}/g
const VOCE = /\\voce\b[ \t]*/g
const COMMENT = /(^|[^\\])%.*$/gm

const inlineClass = new Map([
  ["textbf", "cm-pn-bold"],
  ["emph", "cm-pn-italic"],
  ["textit", "cm-pn-italic"],
  ["underline", "cm-pn-underline"],
  ["texttt", "cm-pn-mono"],
  ["url", "cm-pn-link"],
])

/** "(b)" from a lettera's reference ("…, lettera (b)"), or its number in parentheses. */
function letteraMarker(reference: string, number: string) {
  const tail = /lettera\s+(\S+)$/.exec(reference)?.[1]
  return tail ?? (/^\(.*\)$|\.$/.test(number) ? number : `(${number})`)
}

type Built = { decorations: DecorationSet; atomic: DecorationSet }

function build(view: EditorView, context: DraftContext, path: string): Built {
  const { doc } = view.state
  const text = doc.toString()
  const ranges: Range[] = []
  const line = (at: number, className: string) => {
    const { from } = doc.lineAt(at)
    ranges.push({ from, to: from, deco: Decoration.line({ class: className }) })
  }

  for (let number = 1; number <= doc.lines; number++) {
    const current = doc.line(number)
    if (PREAMBLE.test(current.text)) line(current.from, "cm-pn-preamble")
  }

  // Numbered within the whole document when the file's text is the one in view (it always is, outside an update).
  const document = context.nodesOf(path)
  const { nodes } = document.text === text ? document : parseStructure(text)
  for (const node of nodes) {
    if (node.kind === "comma" || node.kind === "lettera") {
      // `\comma[id=…]` and the spaces after it become "2." / "(b)".
      let end = node.headTo
      while (text[end] === " ") end++
      ranges.push({
        from: node.headFrom,
        to: end,
        deco: Decoration.replace({
          widget: new LabelWidget(
            node.kind === "comma" ? `${node.number}.` : letteraMarker(node.reference, node.number),
            "cm-pn-marker"
          ),
        }),
      })
      line(node.headFrom, node.kind === "comma" ? "cm-pn-comma" : "cm-pn-lettera")
      continue
    }
    if (node.titleFrom === null || node.titleTo === null) continue
    // "1", "Capo 1.2", "Articolo 1.2.1": the number the PDF prints before the title.
    const label = node.kind === "regolamento" ? node.number : node.reference
    ranges.push({
      from: node.headFrom,
      to: node.titleFrom,
      deco: label ? Decoration.replace({ widget: new LabelWidget(label, "cm-pn-heading-number") }) : hidden,
    })
    ranges.push({ from: node.titleTo, to: node.headTo, deco: hidden })
    line(node.headFrom, `cm-pn-heading cm-pn-heading-${node.kind}`)
  }

  for (const match of text.matchAll(ENVIRONMENT)) {
    ranges.push({ from: match.index, to: match.index + match[0].length, deco: hidden })
    line(match.index, "cm-pn-environment")
  }
  for (const match of text.matchAll(VOCE)) {
    ranges.push({
      from: match.index,
      to: match.index + match[0].length,
      deco: Decoration.replace({ widget: new LabelWidget("•", "cm-pn-marker") }),
    })
    line(match.index, "cm-pn-voce")
  }

  for (const match of text.matchAll(INLINE)) {
    const open = match.index + match[1].length + 2
    const close = match.index + match[0].length - 1
    ranges.push({ from: match.index, to: open, deco: hidden })
    if (close > open)
      ranges.push({ from: open, to: close, deco: Decoration.mark({ class: inlineClass.get(match[1]) ?? "" }) })
    ranges.push({ from: close, to: close + 1, deco: hidden })
  }
  for (const match of text.matchAll(HREF)) {
    const open = match.index + match[1].length + 8
    const close = match.index + match[0].length - 1
    ranges.push({ from: match.index, to: open, deco: hidden })
    if (close > open) ranges.push({ from: open, to: close, deco: Decoration.mark({ class: "cm-pn-link" }) })
    ranges.push({ from: close, to: close + 1, deco: hidden })
  }

  // `\rif` prints only the number, as in the PDF; the words around it are the author's.
  const numbers = new Map(context.nodes().flatMap((node) => (node.id ? [[node.id, node.number]] : [])))
  for (const match of text.matchAll(RIF)) {
    const number = numbers.get(match[1])
    ranges.push({
      from: match.index,
      to: match.index + match[0].length,
      deco: Decoration.replace({
        widget: new LabelWidget(
          number ?? `rif. mancante (${match[1] || "vuoto"})`,
          number ? "cm-pn-rif" : "cm-pn-rif cm-pn-rif-missing"
        ),
      }),
    })
  }

  for (const match of text.matchAll(COMMENT)) {
    const from = match.index + match[1].length
    ranges.push({ from, to: match.index + match[0].length, deco: Decoration.mark({ class: "cm-pn-comment-text" }) })
  }

  const valid = ranges.filter((range) => range.from <= range.to && range.to <= doc.length)
  return {
    decorations: Decoration.set(
      valid.map((range) => range.deco.range(range.from, range.to)),
      true
    ),
    // Only what's hidden is atomic: the cursor steps over commands, never over the text they style.
    atomic: Decoration.set(
      valid
        .filter((range) => range.from < range.to && (range.deco.spec.widget !== undefined || range.deco === hidden))
        .map((range) => range.deco.range(range.from, range.to)),
      true
    ),
  }
}

const EMPTY: Built = { decorations: Decoration.none, atomic: Decoration.none }

export function visualMode(context: DraftContext, path: string): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      built: Built
      constructor(view: EditorView) {
        this.built = safeBuild(view, context, path)
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.built = safeBuild(update.view, context, path)
      }
    },
    { decorations: (value) => value.built.decorations }
  )
  return [
    plugin,
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.built.atomic ?? Decoration.none),
    EditorView.contentAttributes.of({ "data-mode": "visual" }),
  ]
}

/** Overlapping replacements (odd text while typing) would throw: fall back to plain text until the text settles. */
function safeBuild(view: EditorView, context: DraftContext, path: string) {
  try {
    return build(view, context, path)
  } catch (error) {
    console.error(error)
    return EMPTY
  }
}
