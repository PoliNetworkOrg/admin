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

export interface AddCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddCategory: (titleIt: string, titleEn: string) => Promise<void>
  initialTitleIt?: string
  initialTitleEn?: string
  mode?: "add" | "edit"
}

export function AddCategoryDialog({
  open,
  onOpenChange,
  onAddCategory,
  initialTitleIt = "",
  initialTitleEn = "",
  mode = "add",
}: AddCategoryDialogProps) {
  const [titleIt, setTitleIt] = useState(initialTitleIt)
  const [titleEn, setTitleEn] = useState(initialTitleEn)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setTitleIt(initialTitleIt)
      setTitleEn(initialTitleEn)
    }
  }, [open, initialTitleIt, initialTitleEn])

  const handleSubmit = async () => {
    const trimmedIt = titleIt.trim()
    if (!trimmedIt) return toast.error("Il titolo della categoria non può essere vuoto.")

    setLoading(true)
    try {
      await onAddCategory(trimmedIt, titleEn.trim())
      setTitleIt("")
      setTitleEn("")
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
          <div className="space-y-1.5">
            <Label htmlFor="catTitleIt">🇮🇹 Titolo (Italiano)</Label>
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
            <Label htmlFor="catTitleEn">🇬🇧 Titolo (Inglese - opzionale)</Label>
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
