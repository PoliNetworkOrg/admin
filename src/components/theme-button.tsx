"use client"
import { useTheme } from "next-themes"
import { FiMoon, FiSun } from "react-icons/fi"
import { Button } from "./ui/button"

export function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()

  // TODO: remove disabled when light theme is ready
  return (
    <Button disabled size="icon" variant="ghost" onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>
      <FiSun className="block dark:hidden" size={20} />
      <FiMoon className="hidden dark:block" size={20} />
    </Button>
  )
}
