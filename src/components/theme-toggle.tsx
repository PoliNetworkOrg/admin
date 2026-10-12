import { Moon, Sun } from "lucide-react"

import { Hint } from "@/components/primitives/hint"
import { themeToggleLabel, useTheme } from "@/components/shell"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = themeToggleLabel(theme)

  return (
    <Hint label={label}>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground"
        onClick={toggleTheme}
        data-theme-toggle=""
        aria-label={label}
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>
    </Hint>
  )
}
