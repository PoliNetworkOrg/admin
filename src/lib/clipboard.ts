/**
 * Copies text. `navigator.clipboard` exists only in secure contexts (HTTPS, localhost), so on plain HTTP (a preview
 * opened by LAN or Tailscale address) this falls back to a hidden textarea and `document.execCommand("copy")`,
 * which still works inside a click handler. Rejects when neither copies.
 */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && "clipboard" in navigator) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  textarea.style.pointerEvents = "none"
  const focused = document.activeElement
  document.body.append(textarea)
  textarea.select()
  try {
    // Deprecated but still supported everywhere, and the only option outside a secure context.
    if (!document.execCommand("copy")) throw new Error("The browser refused to copy.")
  } finally {
    textarea.remove()
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true })
  }
}
