/** Focuses the first field when an inline edit opens, on fine pointers only. */
export function focusOnFinePointer(element: HTMLElement | null) {
  if (element && window.matchMedia("(pointer: fine)").matches) element.focus()
}
