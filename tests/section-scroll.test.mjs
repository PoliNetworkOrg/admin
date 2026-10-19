import assert from "node:assert/strict"
import test from "node:test"

import { observeSectionScroll } from "../src/components/shell/section-scroll.ts"

function installResizeObserver(t, callback) {
  const original = globalThis.ResizeObserver
  globalThis.ResizeObserver = callback
  t.after(() => {
    if (original === undefined) delete globalThis.ResizeObserver
    else globalThis.ResizeObserver = original
  })
}

void test("active section becomes visible when the desktop nav is revealed on mobile", (t) => {
  let resize
  let disconnected = false
  installResizeObserver(
    t,
    class {
      constructor(callback) {
        resize = callback
      }
      observe() {}
      disconnect() {
        disconnected = true
      }
    }
  )
  const current = { offsetLeft: 440, offsetWidth: 100 }
  const nav = {
    clientWidth: 0,
    scrollLeft: 0,
    ownerDocument: {},
    querySelector: () => current,
  }
  const cleanup = observeSectionScroll(nav)
  assert.equal(nav.scrollLeft, 0, "hidden navigation does not change its scroll position")
  nav.clientWidth = 390
  resize()
  assert.equal(nav.scrollLeft, 166, "desktop-to-mobile resize reveals the active pill")
  nav.clientWidth = 320
  resize()
  assert.equal(nav.scrollLeft, 236, "further narrowing keeps the active pill visible")
  current.offsetLeft = 16
  resize()
  assert.equal(nav.scrollLeft, 0, "a pill before the visible range scrolls back into view")
  cleanup()
  assert.equal(disconnected, true)
})

void test("font loading repositions the ancestor pill and cleanup prevents later scrolling", async (t) => {
  let resize
  installResizeObserver(
    t,
    class {
      constructor(callback) {
        resize = callback
      }
      observe() {}
      disconnect() {}
    }
  )
  let fontsReady
  const current = { offsetLeft: 16, offsetWidth: 100 }
  const nav = {
    clientWidth: 390,
    scrollLeft: 0,
    ownerDocument: {
      fonts: {
        ready: new Promise((resolve) => {
          fontsReady = resolve
        }),
      },
    },
    querySelector: (selector) => {
      assert.equal(selector, "[aria-current=page], [data-ancestor]")
      return current
    },
  }
  const cleanup = observeSectionScroll(nav)
  current.offsetLeft = 440
  fontsReady()
  await nav.ownerDocument.fonts.ready
  assert.equal(nav.scrollLeft, 166)
  cleanup()
  current.offsetLeft = 600
  resize()
  assert.equal(nav.scrollLeft, 166, "a queued resize callback cannot scroll after cleanup")
})
