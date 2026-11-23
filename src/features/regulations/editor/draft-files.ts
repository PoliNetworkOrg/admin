/**
 * Adding and removing a draft's source files. The backend allows only paths matching the document's `sources` globs
 * (documents.json, e.g. `RRI.tex` and `regolamenti/*.tex`): anything else blocks the approval.
 */

/** Whether `path` matches a documents.json source glob (`*` within one path segment, `**` across segments). */
export function matchesGlob(path: string, glob: string): boolean {
  const pattern = glob
    .split("**")
    .map((part) =>
      part
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]")
    )
    .join(".*")
  return new RegExp(`^${pattern}$`).test(path)
}

/** A path the document accepts: no globs means anywhere. */
export function allowedPath(path: string, sources: string[]) {
  return sources.length === 0 || sources.some((glob) => matchesGlob(path, glob))
}

/**
 * The folders a new file can go in: those of the globs with a wildcard in the file name only (`regolamenti/*.tex` →
 * `regolamenti/`), in the order of the globs. `""` is the document's own folder.
 */
export function newFileFolders(sources: string[]): string[] {
  if (sources.length === 0) return [""]
  const folders: string[] = []
  for (const glob of sources) {
    const slash = glob.lastIndexOf("/")
    const folder = slash === -1 ? "" : glob.slice(0, slash + 1)
    if (!/[*?]/.test(glob.slice(slash + 1)) || /[*?]/.test(folder)) continue
    if (!folders.includes(folder)) folders.push(folder)
  }
  return folders
}

/** A file name from a title, like the RRI's (`condotta_generale`): lowercase letters, digits and underscores. */
export function fileNameFromTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/, "")
}

export const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

/** The new file's path: the folder, the name, `.tex`. */
export function newFilePath(folder: string, name: string) {
  return `${folder}${name.trim().replace(/\.tex$/i, "")}.tex`
}

/** The main file: the one with `\documentclass`. */
export function entryFile(files: Record<string, string>) {
  return Object.keys(files).find((file) => /\\documentclass/.test(files[file] ?? "")) ?? null
}

/** The main file uses the class `polinetwork-regolamento`: each new file is a regolamento of the raccolta. */
export function isRegolamento(entryText: string) {
  return /\\documentclass(\[[^\]]*\])?\{polinetwork-regolamento\}/.test(entryText)
}

/** A regolamento's new file starts with its `\regolamento`; any other starts empty. */
export function starterText(entryText: string, title: string) {
  return isRegolamento(entryText) && title.trim() ? `\\regolamento{${escapeLatex(title.trim())}}\n\n` : ""
}

const LATEX_SPECIALS = new Map([
  ["\\", "\\textbackslash{}"],
  ["&", "\\&"],
  ["%", "\\%"],
  ["$", "\\$"],
  ["#", "\\#"],
  ["_", "\\_"],
  ["{", "\\{"],
  ["}", "\\}"],
  ["~", "\\textasciitilde{}"],
  ["^", "\\textasciicircum{}"],
])

/** Plain text as LaTeX: the characters LaTeX reads as commands come out as themselves. */
export function escapeLatex(text: string) {
  return text.replace(/[\\&%$#_{}~^]/g, (char) => LATEX_SPECIALS.get(char) ?? char)
}

/** The `\input`s outside comments (after an unescaped `%` on their line). */
function activeInputs(text: string) {
  return [...text.matchAll(INPUT)].filter((match) => {
    const index = match.index ?? 0
    const line = text.slice(text.lastIndexOf("\n", index - 1) + 1, index)
    return !/(^|[^\\])(\\\\)*%/.test(line)
  })
}

const INPUT = /\\(?:input|include)\{([^}]*)\}/g

/**
 * Where to include `path` in the main file: after its last `\input`, in the same style (`./`, `.tex`, a `\newpage`
 * before it when the last one has one), or before `\end{document}`. `null` when there's neither.
 */
export function inputInsertion(entryText: string, path: string): { offset: number; text: string } | null {
  const last = activeInputs(entryText).at(-1)
  if (last?.index !== undefined) {
    const target = last[1]
    const reference = `${target.startsWith("./") ? "./" : ""}${target.endsWith(".tex") ? path : path.replace(/\.tex$/, "")}`
    const lineStart = entryText.lastIndexOf("\n", last.index) + 1
    const indent = /^[ \t]*/.exec(entryText.slice(lineStart))?.[0] ?? ""
    const before = entryText.slice(0, lineStart).replace(/\n[ \t]*$/, "")
    const newpage = /\\newpage[ \t]*$/.test(before) || /\\clearpage[ \t]*$/.test(before)
    const end = last.index + last[0].length
    return {
      offset: end,
      text: `\n\n${newpage ? `${indent}\\newpage\n` : ""}${indent}\\input{${reference}}`,
    }
  }
  const endDocument = entryText.indexOf("\\end{document}")
  if (endDocument === -1) return null
  return { offset: endDocument, text: `\\input{./${path}}\n\n` }
}

/** The `\input` lines that include `path`, from the end so the ranges stay valid while deleting them in order. */
export function inputLinesOf(text: string, path: string): { from: number; to: number }[] {
  const bare = path.replace(/\.tex$/, "")
  const ranges: { from: number; to: number }[] = []
  for (const match of activeInputs(text)) {
    const target = match[1]
      .trim()
      .replace(/^\.\//, "")
      .replace(/\.tex$/, "")
    if (target !== bare || match.index === undefined) continue
    const lineStart = text.lastIndexOf("\n", match.index) + 1
    const newline = text.indexOf("\n", match.index)
    const lineEnd = newline === -1 ? text.length : newline + 1
    // Only a line holding nothing else goes whole, with the `\newpage` line before it and the blank line before
    // that (what "Nuovo file" adds); otherwise just the command.
    const whole = text.slice(lineStart, lineEnd).trim() === match[0]
    if (!whole) {
      ranges.push({ from: match.index, to: match.index + match[0].length })
      continue
    }
    let from = lineStart
    const previous = lineBefore(text, from)
    if (previous !== null && /^[ \t]*\\(newpage|clearpage)[ \t]*$/.test(text.slice(previous, from - 1))) {
      from = previous
      const blank = lineBefore(text, from)
      if (blank !== null && text.slice(blank, from - 1).trim() === "") from = blank
    }
    ranges.push({ from, to: lineEnd })
  }
  return ranges.reverse()
}

/** Where the line before the one starting at `lineStart` starts, or `null` on the first line. */
function lineBefore(text: string, lineStart: number) {
  if (lineStart === 0) return null
  return text.lastIndexOf("\n", lineStart - 2) + 1
}
