import { closeBrackets, completionKeymap } from "@codemirror/autocomplete"
import { defaultKeymap, indentWithTab } from "@codemirror/commands"
import { bracketMatching, indentOnInput } from "@codemirror/language"
import { type Diagnostic, lintGutter, setDiagnostics } from "@codemirror/lint"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { Compartment, EditorState } from "@codemirror/state"
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view"
import { type Ref, useEffect, useImperativeHandle, useRef } from "react"
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next"
import type { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { cn } from "@/lib/utils"

import { type CommentRange, commentMarks, setCommentRanges } from "./comment-marks"
import { editorTheme } from "./editor-theme"
import { type DraftContext, latexLanguage, sourceModeMarks } from "./latex-language"
import { visualMode } from "./visual-mode"

export type EditorMode = "source" | "visual"

export type CodeEditorHandle = {
  /** Selects a range and brings it into view. */
  reveal: (from: number, to: number) => void
  focus: () => void
}

/**
 * One CodeMirror view bound to one file's `Y.Text` (y-codemirror.next): edits, remote cursors and undo go through
 * Yjs. Switching file mounts a new view (the parent keys it by path); mode, read-only state, diagnostics and comment
 * highlights reconfigure the live one.
 */
export function CodeEditor({
  text,
  awareness,
  readOnly,
  mode,
  context,
  path,
  diagnostics,
  comments,
  onSelection,
  onCommentClick,
  handle,
  className,
}: {
  text: Y.Text
  awareness: Awareness | null
  readOnly: boolean
  mode: EditorMode
  context: DraftContext
  /** The file this view edits, to number its nodes within the whole document. */
  path: string
  diagnostics: Diagnostic[]
  comments: CommentRange[]
  onSelection: (selection: { from: number; to: number }) => void
  onCommentClick: (id: string) => void
  handle?: Ref<CodeEditorHandle>
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const compartments = useRef({ mode: new Compartment(), readOnly: new Compartment() })
  const latest = useRef({ onSelection, onCommentClick, context })
  useEffect(() => {
    latest.current = { onSelection, onCommentClick, context }
  })

  // The view lives as long as its Y.Text; the rest reconfigures it below.
  useEffect(() => {
    if (!host.current) return
    const undoManager = new Y.UndoManager(text)
    const stableContext: DraftContext = {
      allText: () => latest.current.context.allText(),
      nodes: () => latest.current.context.nodes(),
      nodesOf: (file) => latest.current.context.nodesOf(file),
    }
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text.toJSON(),
        extensions: [
          highlightActiveLine(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          highlightSelectionMatches(),
          EditorView.lineWrapping,
          keymap.of([...yUndoManagerKeymap, ...completionKeymap, ...defaultKeymap, ...searchKeymap, indentWithTab]),
          latexLanguage(stableContext),
          editorTheme,
          compartments.current.mode.of(mode === "visual" ? visualMode(stableContext, path) : SOURCE_MODE),
          compartments.current.readOnly.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          yCollab(text, awareness, { undoManager }),
          commentMarks((id) => latest.current.onCommentClick(id)),
          EditorView.updateListener.of((update) => {
            if (update.selectionSet || update.docChanged) {
              const { from, to } = update.state.selection.main
              latest.current.onSelection({ from, to })
            }
          }),
          EditorState.phrases.of(ITALIAN_PHRASES),
        ],
      }),
    })
    view.current = created
    return () => {
      created.destroy()
      undoManager.destroy()
      view.current = null
    }
    // Mode and read-only are applied by the effects below; a new view only for a new text or awareness. Undo is
    // Yjs's (yCollab's keymap), so it only undoes one's own edits.
  }, [text, awareness])

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.mode.reconfigure(
        mode === "visual"
          ? visualMode(
              {
                allText: () => latest.current.context.allText(),
                nodes: () => latest.current.context.nodes(),
                nodesOf: (file) => latest.current.context.nodesOf(file),
              },
              path
            )
          : SOURCE_MODE
      ),
    })
  }, [mode, text])

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.readOnly.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    })
  }, [readOnly, text])

  useEffect(() => {
    const current = view.current
    if (!current) return
    const length = current.state.doc.length
    const valid = diagnostics.filter((diagnostic) => diagnostic.from <= length && diagnostic.to <= length)
    current.dispatch(setDiagnostics(current.state, valid))
  }, [diagnostics, text])

  useEffect(() => {
    view.current?.dispatch({ effects: setCommentRanges.of(comments) })
  }, [comments, text])

  useImperativeHandle(handle, () => ({
    reveal(from, to) {
      const current = view.current
      if (!current) return
      const length = current.state.doc.length
      current.dispatch({
        selection: { anchor: Math.min(from, length), head: Math.min(to, length) },
        effects: EditorView.scrollIntoView(Math.min(from, length), { y: "center" }),
      })
      current.focus()
    },
    focus() {
      view.current?.focus()
    },
  }))

  return <div ref={host} className={cn("h-full min-h-0 overflow-hidden", className)} data-mode={mode} />
}

/**
 * Source mode adds line numbers and the problems gutter; the visual mode reads like the document, where hidden
 * command lines would leave the numbers out of step.
 */
const SOURCE_MODE = [lineNumbers(), highlightActiveLineGutter(), lintGutter(), sourceModeMarks]

/** CodeMirror's own words (search panel, completions, lint), in Italian. */
const ITALIAN_PHRASES = {
  Find: "Trova",
  Replace: "Sostituisci",
  next: "successivo",
  previous: "precedente",
  all: "tutti",
  "match case": "maiuscole/minuscole",
  "by word": "parola intera",
  regexp: "espressione regolare",
  replace: "sostituisci",
  "replace all": "sostituisci tutti",
  close: "chiudi",
  "current match": "corrispondenza attuale",
  "on line": "alla riga",
  Diagnostics: "Problemi",
  "No diagnostics": "Nessun problema",
}
