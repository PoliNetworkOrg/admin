import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const storageKey = "polinetwork-theme"

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.documentElement.style.colorScheme = theme
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
    setDark(isDark)
    applyTheme(isDark ? "dark" : "light")
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    window.localStorage.setItem(storageKey, next ? "dark" : "light")
    applyTheme(next ? "dark" : "light")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}
