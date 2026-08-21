import { DynamicIcon, type IconName } from "lucide-react/dynamic"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LanguageBadge } from "./language-badge"

export const UNIVERSITY_FAQ_ICONS: IconName[] = [
  "help-circle",
  "info",
  "book-open",
  "book",
  "bookmark",
  "award",
  "graduation-cap",
  "file-text",
  "edit",
  "calendar",
  "clock",
  "compass",
  "map-pin",
  "briefcase",
  "credit-card",
  "dollar-sign",
  "users",
  "user",
  "globe",
  "send",
  "mail",
  "phone",
  "message-circle",
  "message-square",
  "wifi",
  "cpu",
  "laptop",
  "shield",
  "home",
  "coffee",
  "alert-circle",
  "check-circle",
]

export const DEFAULT_FAQ_ICON: IconName = "help-circle"

export interface AddCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddCategory: (titleIt: string, titleEn: string, icon?: string) => Promise<void>
  initialTitleIt?: string
  initialTitleEn?: string
  initialIcon?: string | null
  mode?: "add" | "edit"
}

export function AddCategoryDialog({
  open,
  onOpenChange,
  onAddCategory,
  initialTitleIt = "",
  initialTitleEn = "",
  initialIcon = DEFAULT_FAQ_ICON,
  mode = "add",
}: AddCategoryDialogProps) {
  const resolvedIcon = initialIcon || DEFAULT_FAQ_ICON
  const [titleIt, setTitleIt] = useState(initialTitleIt)
  const [titleEn, setTitleEn] = useState(initialTitleEn)
  const [icon, setIcon] = useState<string>(resolvedIcon)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setTitleIt(initialTitleIt)
      setTitleEn(initialTitleEn)
      setIcon(initialIcon || DEFAULT_FAQ_ICON)
    }
  }, [open, initialTitleIt, initialTitleEn, initialIcon])

  const handleSubmit = async () => {
    const trimmedIt = titleIt.trim()
    const trimmedEn = titleEn.trim()
    if (!trimmedIt || !trimmedEn) return toast.error("I titoli della categoria non possono essere vuoti.")

    setLoading(true)
    try {
      await onAddCategory(trimmedIt, trimmedEn, icon)
      setTitleIt("")
      setTitleEn("")
      setIcon(DEFAULT_FAQ_ICON)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const isEdit = mode === "edit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica Categoria" : "Aggiungi Categoria"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica i titoli in italiano e inglese per questa categoria."
              : "Crea una nuova categoria per organizzare le FAQ."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5 flex gap-2">
            <Label htmlFor="catIcon">Icona</Label>

            <Select
              value={icon}
              onValueChange={(val) => {
                if (val) setIcon(val)
              }}
            >
              <SelectTrigger id="catIcon">
                <SelectValue placeholder="Seleziona un'icona">
                  <DynamicIcon name={icon as IconName} className="size-4" />
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-auto p-2" align="start">
                <SelectGroup className="grid grid-cols-6 gap-1 p-1">
                  {UNIVERSITY_FAQ_ICONS.map((name) => (
                    <SelectItem
                      key={name}
                      value={name}
                      title={name}
                      className="flex size-9 p-0 pr-0 items-center justify-center rounded-md cursor-pointer hover:bg-accent focus:bg-accent data-[selected]:bg-accent data-[selected]:text-accent-foreground data-[selected]:ring-2 data-[selected]:ring-primary/60 [&_svg]:size-5 [&>span:last-child]:hidden"
                    >
                      <DynamicIcon name={name} className="size-5 mx-auto" />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catTitleIt" className="flex items-center gap-1.5">
              <LanguageBadge lang="it" />
              Titolo
            </Label>
            <Input
              id="catTitleIt"
              placeholder="es. Generali, Iscrizioni, Corsi..."
              value={titleIt}
              onChange={(e) => setTitleIt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catTitleEn" className="flex items-center gap-1.5">
              <LanguageBadge lang="en" />
              Title
            </Label>
            <Input
              id="catTitleEn"
              placeholder="es. General, Enrollment..."
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Annulla</Button>} />
          <Button onClick={handleSubmit} disabled={loading || !titleIt.trim()}>
            {loading ? "Salvataggio..." : isEdit ? "Salva Modifiche" : "Crea Categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
