import { useSyncExternalStore } from "react"

import type { SyncResult } from "./regulations.contract"

type DocumentsSync = { running: boolean; result: SyncResult | null }

const idle: DocumentsSync = { running: false, result: null }
let state = idle
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * The import reads the whole repository and runs in the background: it outlives the Documenti page, so
 * leaving and coming back still shows it running, and then what it left out.
 */
export function useDocumentsSync() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => idle
  )
}

export function setDocumentsSync(next: Partial<DocumentsSync>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}
