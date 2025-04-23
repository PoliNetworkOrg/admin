"use client";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

export function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
    >
      <SunIcon className="block dark:hidden" size={20} />
      <MoonIcon className="hidden dark:block" size={20} />
    </Button>
  );
}
