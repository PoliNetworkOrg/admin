import { type Extension, StateEffect, StateField } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view"
import * as Y from "yjs"

import type { CommentThread } from "../regulations.contract"

/**
 * Comment threads anchored to ranges of a file's `Y.Text` (Yjs relative positions, as the backend stores them), drawn
 * as highlights in the editor. A click on one selects its thread in the panel.
 */

export type CommentRange = { id: string; from: number; to: number; active: boolean; resolved: boolean }

export const setCommentRanges = StateEffect.define<CommentRange[]>()

function decorations(ranges: CommentRange[], length: number) {
  return Decoration.set(
    ranges
      .filter((range) => !range.resolved && range.from < range.to && range.to <= length)
      .map((range) =>
        Decoration.mark({
          class: range.active ? "cm-pn-comment cm-pn-comment-active" : "cm-pn-comment",
          attributes: { "data-comment": range.id },
        }).range(range.from, range.to)
      ),
    true
  )
}

const commentField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes)
    for (const effect of transaction.effects)
      if (effect.is(setCommentRanges)) next = decorations(effect.value, transaction.state.doc.length)
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

export function commentMarks(onSelect: (id: string) => void): Extension {
  return [
    commentField,
    EditorView.domEventHandlers({
      click(event) {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-comment]") : null
        if (target?.dataset.comment) onSelect(target.dataset.comment)
        return false
      },
    }),
  ]
}

export function encodePosition(text: Y.Text, index: number, assoc: number) {
  const bytes = Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, index, assoc))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodePosition(document: Y.Doc, encoded: string) {
  try {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    return Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(bytes), document)
  } catch (error) {
    console.error(error)
    return null
  }
}

/** Where a thread's anchor sits now in `file`'s text, or null when the text it marked is gone. */
export function resolveAnchor(document: Y.Doc, text: Y.Text, thread: Pick<CommentThread, "anchor">) {
  const start = decodePosition(document, thread.anchor.start)
  const end = decodePosition(document, thread.anchor.end)
  if (!start || !end || start.type !== text || end.type !== text || end.index <= start.index) return null
  return { from: start.index, to: end.index }
}
