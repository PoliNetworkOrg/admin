/** Keep the active section visible after navigation, font loading, and changes to the mobile nav's size. */
export function observeSectionScroll(nav: HTMLElement) {
  let live = true
  /** Scroll only as far as needed to show the current or ancestor pill with the nav's 16px edge padding. */
  const reveal = () => {
    if (!live || nav.clientWidth === 0) return
    const current = nav.querySelector<HTMLElement>("[aria-current=page], [data-ancestor]")
    if (!current) return
    const start = current.offsetLeft - 16
    const end = current.offsetLeft + current.offsetWidth + 16 - nav.clientWidth
    if (nav.scrollLeft > start) nav.scrollLeft = start
    else if (nav.scrollLeft < end) nav.scrollLeft = end
  }
  const observer = new ResizeObserver(reveal)
  observer.observe(nav)
  reveal()
  void nav.ownerDocument.fonts?.ready.then(reveal)
  return () => {
    live = false
    observer.disconnect()
  }
}
