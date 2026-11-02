import { FileText, Folder } from "lucide-react"

import { cn } from "@/lib/utils"

import type { StructureNode } from "../latex-structure"

/**
 * The draft's source files as a tree (directories from their paths), then the open file's outline: regolamenti,
 * capi and articoli as the parser reads them, each a link to its place in the text.
 */
export function EditorSidebar({
  files,
  current,
  onOpen,
  outline,
  onReveal,
  problemsByFile,
  className,
}: {
  files: string[]
  current: string | null
  onOpen: (path: string) => void
  outline: StructureNode[]
  onReveal: (node: StructureNode) => void
  problemsByFile: Map<string, number>
  className?: string
}) {
  const rows = treeRows(files)
  const headings = outline.filter((node) => node.kind !== "comma" && node.kind !== "lettera")
  return (
    <aside className={cn("flex min-h-0 flex-col gap-4 overflow-auto", className)} aria-label="File e indice">
      <nav aria-label="File">
        <h2 className="px-2 pb-1 text-[12px] font-medium text-(--pn-fg-muted)">File</h2>
        <ul className="flex flex-col">
          {rows.map((row) =>
            row.kind === "dir" ? (
              <li
                key={`dir:${row.path}`}
                className="flex h-8 items-center gap-2 px-2 text-[13px] text-(--pn-fg-muted)"
                style={{ paddingLeft: 8 + row.depth * 14 }}
              >
                <Folder aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{row.name}</span>
              </li>
            ) : (
              <li key={row.path}>
                <button
                  type="button"
                  aria-current={row.path === current ? "true" : undefined}
                  onClick={() => onOpen(row.path)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-(--pn-r-2) px-2 text-left text-[13px] transition-[background-color,color] duration-120",
                    row.path === current
                      ? "bg-(--pn-accent-soft) text-(--pn-fg)"
                      : "text-(--pn-fg) hover:bg-(--pn-hover)"
                  )}
                  style={{ paddingLeft: 8 + row.depth * 14 }}
                >
                  <FileText
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      row.path === current ? "text-(--pn-accent)" : "text-(--pn-fg-muted)"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  {problemsByFile.get(row.path) ? (
                    <span
                      className="rounded-(--pn-r-full) bg-(--pn-danger-bg) px-1.5 text-[11px] font-medium text-(--pn-danger-fg) tabular-nums"
                      aria-label={`${problemsByFile.get(row.path)} problemi`}
                    >
                      {problemsByFile.get(row.path)}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          )}
        </ul>
      </nav>
      {headings.length > 0 ? (
        <nav aria-label="Indice del file">
          <h2 className="px-2 pb-1 text-[12px] font-medium text-(--pn-fg-muted)">Indice</h2>
          <ul className="flex flex-col">
            {headings.map((node) => (
              <li key={`${node.kind}:${node.headFrom}`}>
                <button
                  type="button"
                  onClick={() => onReveal(node)}
                  className={cn(
                    "flex min-h-7 w-full items-baseline gap-1.5 rounded-(--pn-r-2) px-2 py-1 text-left text-[13px] leading-5 text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-hover)",
                    node.kind === "regolamento" && "font-medium"
                  )}
                  style={{ paddingLeft: 8 + node.depth * 10 }}
                >
                  {node.kind === "articolo" ? (
                    <span className="shrink-0 text-(--pn-fg-muted) tabular-nums">{node.number}</span>
                  ) : null}
                  <span className="min-w-0 truncate">
                    {node.kind === "capo" ? `Capo ${node.number} · ${node.title ?? ""}` : (node.title ?? "")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </aside>
  )
}

type Row = { kind: "dir" | "file"; path: string; name: string; depth: number }

/** Directories before their files, each level sorted by name. */
export function treeRows(paths: string[]): Row[] {
  const rows: Row[] = []
  const seen = new Set<string>()
  const sorted = [...paths].sort((a, b) => {
    const [da, db] = [a.split("/"), b.split("/")]
    for (let index = 0; index < Math.min(da.length, db.length); index++) {
      if (da[index] === db[index]) continue
      const aIsDir = index < da.length - 1
      const bIsDir = index < db.length - 1
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
      return da[index].localeCompare(db[index])
    }
    return da.length - db.length
  })
  for (const path of sorted) {
    const parts = path.split("/")
    for (let depth = 0; depth < parts.length - 1; depth++) {
      const dir = parts.slice(0, depth + 1).join("/")
      if (seen.has(dir)) continue
      seen.add(dir)
      rows.push({ kind: "dir", path: dir, name: parts[depth], depth })
    }
    rows.push({ kind: "file", path, name: parts.at(-1) ?? path, depth: parts.length - 1 })
  }
  return rows
}
