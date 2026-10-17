import { useEffect, useState } from "react"

/** "⌘" on Apple platforms, "Ctrl" elsewhere; "Ctrl" during SSR. */
export function useModifierKey(): string {
  const [key, setKey] = useState("Ctrl")
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(window.navigator.userAgent)) setKey("⌘")
  }, [])
  return key
}
