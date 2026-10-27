/** A document version's PDF, as the request page shows it. */
export type LandingPdf = { documentId: string; base64: string; fileName: string }

/**
 * A signature made on New request lands on the page of the request it created. That page opens under the signing
 * dialog, draws the signed spot with the boxes still over it, and only then do the dialog and the agent window close,
 * as when signing from the request page itself.
 */
export type Landing = {
  requestId: string
  /** The new version's PDF, fetched before the page opened, so it draws at once. */
  pdf: LandingPdf | null
  /** Called by the request page once the signed spot is drawn. */
  painted: () => void
  /** Set by the request page: called as the dialog closes, so its boxes dissolve into the stamps. */
  release: (() => void) | null
  /** Set by the request page: where focus goes after the dialog. */
  focus: (() => HTMLElement | null) | null
}

let expected: Landing | null = null

/** Announces a landing on `requestId`'s page; `painted` resolves once that page drew the signed spot. */
export function expectLanding(requestId: string, pdf: LandingPdf | null) {
  let resolve = () => {}
  const painted = new Promise<void>((done) => {
    resolve = done
  })
  const landing: Landing = { requestId, pdf, painted: resolve, release: null, focus: null }
  expected = landing
  return {
    painted,
    /** The dialog is closing: the page lets its boxes go, and the landing is over. */
    release() {
      landing.release?.()
      if (expected === landing) expected = null
    },
    focus: () => landing.focus?.() ?? null,
  }
}

/** The landing a request page opening now is part of, if any. */
export function landingFor(requestId: string): Landing | null {
  return expected?.requestId === requestId ? expected : null
}
