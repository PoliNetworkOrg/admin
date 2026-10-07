import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useNavigate } from "@tanstack/react-router"
import { Command } from "cmdk"
import { LogOut, type LucideIcon, Moon, Search, Sun, UserRound } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"

import { panelServices } from "./nav"
import { ServiceGlyph } from "./service-glyph"
import { useTheme } from "./theme"

type PaletteEntry = { id: string; label: string; glyph: ReactNode; run: () => void }
type PaletteGroup = { heading: string; entries: PaletteEntry[] }

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

function matches(haystack: string, query: string) {
  return query === "" || normalize(haystack).includes(query)
}

const glyphClass = "size-4 shrink-0 text-(--pn-fg-muted)"

function actionGlyph(Icon: LucideIcon) {
  return <Icon aria-hidden className={glyphClass} />
}

export type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
}

/** ⌘K palette (docs/design.md §2.5): every section and the shell actions. No animation. */
export function CommandPalette({ open, onOpenChange, onSignOut }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const normalizedQuery = normalize(query)

  function setOpen(next: boolean) {
    if (!next) setQuery("")
    onOpenChange(next)
  }

  const groups = useMemo((): PaletteGroup[] => {
    const sections: PaletteEntry[] = panelServices.flatMap((service) =>
      service.sections.map((section) => ({
        id: `section:${service.id}:${section.id}`,
        label: `${service.title} › ${section.title}`,
        glyph: <ServiceGlyph service={service} className={glyphClass} />,
        run: () => void navigate({ to: section.path }),
      }))
    )

    const actions: PaletteEntry[] = [
      {
        id: "action:theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        glyph: actionGlyph(theme === "dark" ? Sun : Moon),
        run: toggleTheme,
      },
      {
        id: "action:account",
        label: "Open account",
        glyph: actionGlyph(UserRound),
        run: () => void navigate({ to: "/dashboard/account" }),
      },
      { id: "action:sign-out", label: "Sign out", glyph: actionGlyph(LogOut), run: onSignOut },
    ]

    return [
      { heading: "Sections", entries: sections.filter((entry) => matches(entry.label, normalizedQuery)) },
      { heading: "Actions", entries: actions.filter((entry) => matches(entry.label, normalizedQuery)) },
    ].filter((group) => group.entries.length > 0)
  }, [normalizedQuery, navigate, theme, toggleTheme, onSignOut])

  function run(entry: PaletteEntry) {
    setOpen(false)
    entry.run()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="duration-0 data-closed:animate-none data-open:animate-none" />
        <DialogPrimitive.Popup className="fixed top-[15vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-(--pn-r-5) bg-(--pn-surface-raised) text-(--pn-fg) shadow-(--pn-shadow-modal) outline-none">
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command shouldFilter={false} loop label="Command palette">
            <div className="flex h-12 items-center gap-2.5 border-b border-(--pn-line) px-4">
              <Search aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search sections and actions…"
                data-focus-ring="none"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-(--pn-fg) outline-none placeholder:text-(--pn-fg-subtle)"
              />
            </div>
            <Command.List className="max-h-[min(440px,calc(85vh-48px))] scroll-py-2 overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="p-8 text-center text-[13px] text-(--pn-fg-muted)">
                Nothing matches “{query}”.
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-(--pn-fg-muted)"
                >
                  {group.entries.map((entry) => (
                    <Command.Item
                      key={entry.id}
                      value={entry.id}
                      onSelect={() => run(entry)}
                      className="flex h-10 cursor-default items-center gap-3 rounded-(--pn-r-2) px-2 text-[14px] select-none data-[selected=true]:bg-(--pn-muted)"
                    >
                      {entry.glyph}
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
