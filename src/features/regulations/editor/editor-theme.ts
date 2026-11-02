import { EditorView } from "@codemirror/view"

/**
 * The editor in the dashboard's tokens. Source mode is DM Mono; the visual mode reads like the document, in DM Sans,
 * with headings, numbered commi and lettere. Remote cursors take each collaborator's color (yCollab).
 */
export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13.5px",
    color: "var(--pn-fg)",
    backgroundColor: "var(--pn-surface)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--pn-fg)" },
  ".cm-content[data-mode=visual]": {
    fontFamily: "var(--font-sans)",
    fontSize: "15px",
    lineHeight: "1.65",
    maxWidth: "76ch",
    margin: "0 auto",
  },
  ".cm-line": { padding: "0 16px" },
  ".cm-gutters": {
    backgroundColor: "var(--pn-surface)",
    color: "var(--pn-fg-subtle)",
    borderRight: "1px solid var(--pn-line)",
  },
  ".cm-activeLine": { backgroundColor: "var(--pn-hover)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--pn-hover)", color: "var(--pn-fg-muted)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--pn-selection) !important",
  },
  ".cm-cursor": { borderLeftColor: "var(--pn-fg)" },
  ".cm-matchingBracket": { backgroundColor: "var(--pn-accent-soft)", outline: "none" },
  ".cm-selectionMatch": { backgroundColor: "var(--pn-accent-soft)" },
  ".cm-tooltip": {
    backgroundColor: "var(--pn-surface-raised)",
    color: "var(--pn-fg)",
    border: "1px solid var(--pn-line)",
    borderRadius: "var(--pn-r-4)",
    boxShadow: "var(--pn-shadow-float)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul > li": { padding: "4px 10px", fontFamily: "inherit" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--pn-accent-soft)",
    color: "var(--pn-fg)",
  },
  ".cm-completionDetail": { color: "var(--pn-fg-muted)", fontStyle: "normal", marginLeft: "8px" },
  ".cm-completionInfo": { padding: "6px 10px", maxWidth: "280px" },
  ".cm-panels": { backgroundColor: "var(--pn-surface)", color: "var(--pn-fg)", borderColor: "var(--pn-line)" },
  ".cm-panel input, .cm-panel button": { fontSize: "13px" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--pn-danger-solid)" },
  ".cm-diagnostic-warning": { borderLeftColor: "var(--pn-warning-solid)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--pn-danger-solid)",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--pn-warning-solid)",
    textUnderlineOffset: "3px",
  },
  ".cm-lint-marker": { width: "0.8em", height: "0.8em" },

  // Source mode: the grammar's macros and the system's ids.
  ".cm-pn-structure": { color: "var(--pn-accent)", fontWeight: "600" },
  ".cm-pn-id": { color: "var(--pn-fg-subtle)", opacity: "0.7" },

  // Comments.
  ".cm-pn-comment": {
    backgroundColor: "color-mix(in oklab, var(--pn-warning-solid) 18%, transparent)",
    borderBottom: "2px solid color-mix(in oklab, var(--pn-warning-solid) 55%, transparent)",
    cursor: "pointer",
  },
  ".cm-pn-comment-active": { backgroundColor: "color-mix(in oklab, var(--pn-warning-solid) 34%, transparent)" },

  // Visual mode.
  ".cm-pn-preamble": {
    fontFamily: "var(--font-mono)",
    fontSize: "12.5px",
    color: "var(--pn-fg-subtle)",
  },
  ".cm-pn-heading": { fontWeight: "600", color: "var(--pn-fg)" },
  ".cm-pn-heading-regolamento": { fontSize: "22px", lineHeight: "1.4", paddingTop: "18px", textAlign: "center" },
  ".cm-pn-heading-capo": { fontSize: "17px", paddingTop: "12px", textAlign: "center" },
  ".cm-pn-heading-articolo": { fontSize: "15.5px", paddingTop: "10px" },
  ".cm-pn-heading-number": { color: "var(--pn-fg-muted)", marginRight: "0.6em", fontWeight: "600" },
  ".cm-pn-environment": { fontSize: "0", lineHeight: "6px" },
  ".cm-pn-comma": { paddingLeft: "40px !important", textIndent: "-24px" },
  ".cm-pn-lettera": { paddingLeft: "64px !important", textIndent: "-22px" },
  ".cm-pn-marker": {
    display: "inline-block",
    minWidth: "22px",
    textIndent: "0",
    color: "var(--pn-fg-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-pn-voce": { paddingLeft: "64px !important", textIndent: "-18px" },
  ".cm-pn-mono": { fontFamily: "var(--font-mono)", fontSize: "0.92em" },
  ".cm-pn-bold": { fontWeight: "700" },
  ".cm-pn-italic": { fontStyle: "italic" },
  ".cm-pn-underline": { textDecoration: "underline" },
  ".cm-pn-link": { color: "var(--pn-accent)", textDecoration: "underline" },
  ".cm-pn-rif": {
    color: "var(--pn-accent)",
    backgroundColor: "var(--pn-accent-soft)",
    borderRadius: "var(--pn-r-1)",
    padding: "0 3px",
  },
  ".cm-pn-rif-missing": { color: "var(--pn-danger-fg)", backgroundColor: "var(--pn-danger-bg)" },
  ".cm-pn-comment-text": { color: "var(--pn-fg-subtle)" },
})
