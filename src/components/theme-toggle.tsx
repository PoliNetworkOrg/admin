import { Moon, Sun } from "lucide-react"

import { themeToggleLabel, useTheme } from "@/components/shell"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = themeToggleLabel(theme)

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  )
}
