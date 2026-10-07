/** Focuses the first field when an inline edit opens, on fine pointers only (§5.4 autofocus rule). */
export function focusOnFinePointer(element: HTMLElement | null) {
  if (element && window.matchMedia("(pointer: fine)").matches) element.focus()
}
