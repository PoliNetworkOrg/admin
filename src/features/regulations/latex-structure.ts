/**
 * A light reader of the regolamento grammar (PoliNetworkOrg/legal `docs/grammar.md`): regolamento → capo (nesting) →
 * articolo → comma → lettera, with the ids the system inserts. The backend's parser is the authority (structure,
 * merge, diff, numbering); this one only drives what the editor shows: the visual mode's headings and numbers, the
 * outline, and the `\rif` completions. Agent mode's fake backend uses it too. It never throws: text may be invalid
 * while people type.
 */

export const NODE_KINDS = ["regolamento", "capo", "articolo", "comma", "lettera"] as const
export type NodeKind = (typeof NODE_KINDS)[number]

export type StructureNode = {
  kind: NodeKind
  id: string | null
  /** For regolamento, capo and articolo. */
  title: string | null
  /** The command, from `\` to the end of its title (or of its options). */
  headFrom: number
  headTo: number
  /** The title's text range, inside the braces. */
  titleFrom: number | null
  titleTo: number | null
  /** The `[id=…, …]` options' range, hidden in the visual mode. */
  idFrom: number | null
  idTo: number | null
  /** The whole node, up to the next node at its level or above (a capo, through its `\end{capo}`). */
  from: number
  to: number
  /**
   * As `\rif` prints it: regolamento "1"; capi and articoli number as siblings inside their parent ("1.2", "1.2.1");
   * commi "3"; lettere "a", nested "i".
   */
  number: string
  /** "Articolo 1.2.1", "Capo 1.2", "Articolo 1.2.1, comma 3", "Articolo 1.2.1, comma 3, lettera (b)". */
  reference: string
  /** "Regolamento Fondamentale › Capo 1.2 › Articolo 1.2.1 › comma 3". */
  path: string
  /** Nesting depth: 0 for a regolamento. */
  depth: number
}

export type StructureProblem = { from: number; to: number; message: string }

export type Structure = { nodes: StructureNode[]; problems: StructureProblem[] }

/** Lowercase base36, 6 characters, unique per document (grammar). */
export const NODE_ID = /^[0-9a-z]{6}$/

const OPTION_KEYS = new Set(["id", "nuovapagina"])
const TOKEN =
  /\\(regolamento|articolo|comma|lettera|voce)(?![A-Za-z])(\s*\[[^\]\n]*\])?|\\(begin|end)\{(capo|commi|lettere|elenco)\}(\s*\[[^\]\n]*\])?/g

/** The text inside the braces that start at `open` (`text[open] === "{"`), allowing nested braces. */
function braced(text: string, open: number): { from: number; to: number } | null {
  if (text[open] !== "{") return null
  let depth = 0
  for (let index = open; index < text.length; index++) {
    const char = text[index]
    if (char === "\\") {
      index++
      continue
    }
    if (char === "{") depth++
    else if (char === "}") {
      depth--
      if (depth === 0) return { from: open + 1, to: index }
    } else if (char === "\n" && text[index + 1] === "\n") return null
  }
  return null
}

/** Whether `index` sits in a `%` comment. */
function inComment(text: string, index: number) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1
  for (let cursor = lineStart; cursor < index; cursor++) {
    if (text[cursor] === "\\") cursor++
    else if (text[cursor] === "%") return true
  }
  return false
}

function letter(n: number) {
  let result = ""
  let value = n
  while (value > 0) {
    value--
    result = String.fromCharCode(97 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

const ROMAN: [number, string][] = [
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
]

function roman(n: number) {
  let result = ""
  let value = n
  for (const [amount, numeral] of ROMAN)
    while (value >= amount) {
      result += numeral
      value -= amount
    }
  return result
}

/** Plain text of a title: drops commands and braces, keeps their content. */
export function plainTitle(title: string) {
  return title
    .replace(/\\(textbf|emph|textit|underline|texttt)\{([^{}]*)\}/g, "$2")
    .replace(/\\([&%$#_])/g, "$1")
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** `[id=k3x9q1, nuovapagina]` → its id and unknown keys. */
function parseOptions(block: string | undefined) {
  const unknown: string[] = []
  if (!block) return { id: null, unknown }
  const inner = block.slice(block.indexOf("[") + 1, block.lastIndexOf("]"))
  let id: string | null = null
  for (const part of inner.split(",")) {
    const [rawKey, ...rest] = part.split("=")
    const key = rawKey.trim()
    if (!key) continue
    if (key === "id") id = rest.join("=").trim()
    else if (!OPTION_KEYS.has(key)) unknown.push(key)
  }
  return { id, unknown }
}

function kindOf(command: string | undefined): NodeKind {
  if (command === "regolamento" || command === "articolo" || command === "comma") return command
  return command === "lettera" ? "lettera" : "capo"
}

function commandName(kind: NodeKind) {
  return kind === "capo" ? "\\begin{capo}" : `\\${kind}`
}

function label(node: Pick<StructureNode, "kind" | "number" | "title">) {
  if (node.kind === "regolamento") return plainTitle(node.title ?? "")
  if (node.kind === "capo") return `Capo ${node.number}`
  if (node.kind === "articolo") return `Articolo ${node.number}`
  if (node.kind === "comma") return `comma ${node.number}`
  return `lettera (${node.number})`
}

type Open = StructureNode & { children: number }
type List = { name: string; from: number; count: number; item: StructureNode | null }

export function parseStructure(text: string): Structure {
  const problems: StructureProblem[] = []
  const nodes: Open[] = []
  const seenIds = new Set<string>()
  let regolamenti = 0
  /** Open regolamento, capi and articolo, outermost first. */
  const headings: Open[] = []
  /** Open list environments (commi, lettere, elenco), with their item count and current item. */
  const lists: List[] = []

  const closeItemsFrom = (listIndex: number, at: number) => {
    for (let index = lists.length - 1; index >= listIndex; index--) {
      const item = lists[index].item
      if (item && item.to > at) item.to = at
    }
  }
  const closeListsAt = (at: number) => {
    closeItemsFrom(0, at)
    for (const list of lists)
      problems.push({
        from: list.from,
        to: list.from + `\\begin{${list.name}}`.length,
        message: `\\begin{${list.name}} senza \\end{${list.name}}`,
      })
    lists.length = 0
  }
  /** Closes headings from `index` inward at `at`. */
  const closeHeadings = (index: number, at: number) => {
    for (let cursor = headings.length - 1; cursor >= index; cursor--) {
      const node = headings[cursor]
      if (node.kind === "capo")
        problems.push({ from: node.headFrom, to: node.headTo, message: "\\begin{capo} senza \\end{capo}" })
      if (node.to > at) node.to = at
    }
    headings.length = index
  }

  for (const match of text.matchAll(TOKEN)) {
    if (inComment(text, match.index)) continue
    const at = match.index
    const end = at + match[0].length
    const [, command, commandOptions, verb, environment, environmentOptions] = match
    const optionBlock = commandOptions ?? environmentOptions

    if (verb === "end") {
      if (environment === "capo") {
        const capo = headings.findLastIndex((heading) => heading.kind === "capo")
        if (capo < 0) {
          problems.push({ from: at, to: end, message: "\\end{capo} senza \\begin{capo}" })
          continue
        }
        closeListsAt(at)
        // Articoli inside close where the capo ends; the capo itself includes its `\end{capo}`.
        for (let cursor = headings.length - 1; cursor > capo; cursor--) headings[cursor].to = at
        headings[capo].to = end
        headings.length = capo
        continue
      }
      const top = lists.at(-1)
      if (!top || top.name !== environment) {
        problems.push({
          from: at,
          to: end,
          message: top
            ? `\\end{${environment}} chiude \\begin{${top.name}}`
            : `\\end{${environment}} senza \\begin{${environment}}`,
        })
        continue
      }
      closeItemsFrom(lists.length - 1, at)
      lists.pop()
      continue
    }

    if (verb === "begin" && environment !== "capo") {
      if (environment === "commi" && headings.at(-1)?.kind !== "articolo")
        problems.push({ from: at, to: end, message: "\\begin{commi} fuori da un \\articolo" })
      lists.push({ name: environment, from: at, count: 0, item: null })
      continue
    }

    if (command === "voce") {
      if (lists.at(-1)?.name !== "elenco")
        problems.push({ from: at, to: end, message: "\\voce fuori da \\begin{elenco}" })
      continue
    }

    // A node: regolamento, capo, articolo, comma or lettera.
    const kind = kindOf(command)
    const { id, unknown } = parseOptions(optionBlock)
    const optionFrom = optionBlock ? at + match[0].indexOf("[") : null
    for (const key of unknown)
      problems.push({ from: optionFrom ?? at, to: end, message: `Opzione sconosciuta: ${key}` })

    let headTo = end
    let titleFrom: number | null = null
    let titleTo: number | null = null
    let title: string | null = null
    if (kind === "regolamento" || kind === "capo" || kind === "articolo") {
      let open = end
      while (text[open] === " " || text[open] === "\t") open++
      const brace = braced(text, open)
      if (brace) {
        titleFrom = brace.from
        titleTo = brace.to
        title = text.slice(brace.from, brace.to)
        headTo = brace.to + 1
      } else problems.push({ from: at, to: end, message: `${commandName(kind)} senza titolo tra graffe` })
    }

    if (kind !== "lettera") {
      if (!id)
        problems.push({ from: at, to: headTo, message: `${commandName(kind)} senza id: lo inserisce il sistema` })
      else if (!NODE_ID.test(id)) problems.push({ from: optionFrom ?? at, to: end, message: `Id non valido: ${id}` })
      else if (seenIds.has(id)) problems.push({ from: optionFrom ?? at, to: end, message: `Id ripetuto: ${id}` })
      else seenIds.add(id)
    }

    let number = "?"
    let depth: number
    if (kind === "regolamento") {
      closeListsAt(at)
      closeHeadings(0, at)
      number = String(++regolamenti)
      depth = 0
    } else if (kind === "capo" || kind === "articolo") {
      closeListsAt(at)
      // A new capo or articolo closes an open articolo; capi stay open until `\end{capo}`.
      if (headings.at(-1)?.kind === "articolo") closeHeadings(headings.length - 1, at)
      const parent = headings.at(-1)
      if (parent) number = `${parent.number}.${++parent.children}`
      else problems.push({ from: at, to: headTo, message: `${commandName(kind)} fuori da un \\regolamento` })
      depth = headings.length
    } else {
      const listName = kind === "comma" ? "commi" : "lettere"
      const list = lists.at(-1)
      if (list?.name === listName) {
        closeItemsFrom(lists.length - 1, at)
        list.count++
        const nested = lists.filter((other) => other.name === "lettere").length > 1
        number = kind === "comma" ? String(list.count) : nested ? roman(list.count) : letter(list.count)
      } else problems.push({ from: at, to: headTo, message: `\\${kind} fuori da \\begin{${listName}}` })
      depth = headings.length + lists.length
    }

    const own = label({ kind, number, title })
    const article = headings.findLast((heading) => heading.kind === "articolo")
    const comma = lists.flatMap((list) => (list.item?.kind === "comma" ? [list.item] : [])).at(-1)
    const prefix =
      kind === "comma" ? article?.reference : kind === "lettera" ? (comma ?? article)?.reference : undefined
    const node: Open = {
      kind,
      id: id || null,
      title: title === null ? null : plainTitle(title),
      headFrom: at,
      headTo,
      titleFrom,
      titleTo,
      idFrom: optionFrom,
      idTo: optionBlock ? end : null,
      from: at,
      to: text.length,
      number,
      reference: prefix ? `${prefix}, ${own}` : own,
      path: [
        ...headings.map((heading) => label(heading)),
        ...lists.flatMap((list) => (list.item ? [label(list.item)] : [])),
        own,
      ].join(" › "),
      depth,
      children: 0,
    }
    if (kind === "regolamento" || kind === "capo" || kind === "articolo") headings.push(node)
    else {
      const list = lists.at(-1)
      if (list) list.item = node
    }
    nodes.push(node)
  }

  closeListsAt(text.length)
  for (const heading of headings)
    if (heading.kind === "capo")
      problems.push({ from: heading.headFrom, to: heading.headTo, message: "\\begin{capo} senza \\end{capo}" })

  // `\rif{id}` must point at a node with an id.
  for (const match of text.matchAll(/\\rif\{([^}]*)\}/g)) {
    if (inComment(text, match.index)) continue
    if (!seenIds.has(match[1]))
      problems.push({
        from: match.index,
        to: match.index + match[0].length,
        message: `\\rif a un id inesistente: ${match[1] || "vuoto"}`,
      })
  }

  return {
    nodes: nodes.map(({ children, ...node }) => (void children, node)),
    problems: problems.sort((a, b) => a.from - b.from),
  }
}

export type FileNode = StructureNode & { file: string }
export type FileProblem = StructureProblem & { file: string }

/** `\input{regolamenti/x}` → `regolamenti/x.tex`. */
function inputPath(name: string) {
  return name.endsWith(".tex") ? name : `${name}.tex`
}

type Segment = { file: string; start: number; offset: number; length: number }

/**
 * The whole document, as the PDF numbers it: `\input` files are read in place (a capo may continue in the next file),
 * then every node and problem is located in its own file. A node continuing into another file ends at the end of the
 * file where it starts.
 */
export function parseDocument(files: Readonly<Record<string, string>>, entry: string) {
  const segments: Segment[] = []
  let text = ""
  const visiting = new Set<string>()
  const inline = (file: string) => {
    const source = files[file]
    if (source === undefined || visiting.has(file)) return
    visiting.add(file)
    let cursor = 0
    for (const match of source.matchAll(/\\input\{([^}]+)\}/g)) {
      if (inComment(source, match.index)) continue
      segments.push({ file, start: text.length, offset: cursor, length: match.index - cursor })
      text += source.slice(cursor, match.index)
      inline(inputPath(match[1].trim()))
      cursor = match.index + match[0].length
    }
    segments.push({ file, start: text.length, offset: cursor, length: source.length - cursor })
    text += source.slice(cursor)
    visiting.delete(file)
  }
  inline(entry)
  // Files nobody inputs are still read, after the rest.
  for (const file of Object.keys(files))
    if (file.endsWith(".tex") && !segments.some((segment) => segment.file === file)) inline(file)

  const locate = (at: number) => {
    const segment =
      segments.find((candidate) => at >= candidate.start && at < candidate.start + candidate.length) ??
      segments.findLast((candidate) => at >= candidate.start)
    if (!segment) return { file: entry, local: at }
    return { file: segment.file, local: segment.offset + Math.min(at - segment.start, segment.length) }
  }

  const parsed = parseStructure(text)
  const nodes: FileNode[] = parsed.nodes.map((node) => {
    const head = locate(node.headFrom)
    const shift = (value: number | null) => (value === null ? null : head.local + (value - node.headFrom))
    const last = locate(Math.max(node.headFrom, node.to - 1))
    return {
      ...node,
      file: head.file,
      from: head.local,
      headFrom: head.local,
      headTo: head.local + (node.headTo - node.headFrom),
      titleFrom: shift(node.titleFrom),
      titleTo: shift(node.titleTo),
      idFrom: shift(node.idFrom),
      idTo: shift(node.idTo),
      to: last.file === head.file ? last.local + 1 : (files[head.file]?.length ?? head.local),
    }
  })
  const problems: FileProblem[] = parsed.problems.map((problem) => {
    const where = locate(problem.from)
    return { ...problem, file: where.file, from: where.local, to: where.local + (problem.to - problem.from) }
  })
  return { nodes, problems }
}

/** A fresh node id, unique among `taken`. */
export function newNodeId(taken: ReadonlySet<string>, random: () => number = Math.random) {
  for (;;) {
    let id = ""
    for (let index = 0; index < 6; index++) id += Math.floor(random() * 36).toString(36)
    if (!taken.has(id)) return id
  }
}

/** Every id in the text, from any option list (`[id=…]`, `[id=…, nuovapagina]`). */
export function idsIn(text: string): Set<string> {
  return new Set([...text.matchAll(/\[[^\]\n]*\bid\s*=\s*([0-9a-z]{6})\b[^\]\n]*\]/g)].map((match) => match[1]))
}

/** 1-based line and column of an offset. */
export function lineColumn(text: string, offset: number) {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset && index < text.length; index++)
    if (text[index] === "\n") {
      line++
      lineStart = index + 1
    }
  return { line, column: offset - lineStart + 1 }
}
