import { useState } from "react"

/**
 * Increments each time `open` turns true. Key the dialog body with it so every opening starts from
 * clean state without resetting during the close animation.
 */
export function useOpenGeneration(open: boolean) {
  const [generation, setGeneration] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setGeneration((current) => current + 1)
  }
  return generation
}
