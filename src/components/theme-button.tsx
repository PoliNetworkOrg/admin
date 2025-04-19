import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeButton() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="text-foreground hover:text-accent-foreground"
    >
      <SunIcon className="block h-6 w-6 dark:hidden" />
      <MoonIcon className="hidden h-6 w-6 dark:block" />
    </button>
  );
}
