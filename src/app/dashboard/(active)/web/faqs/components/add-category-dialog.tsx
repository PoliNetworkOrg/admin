import { useState } from "react"
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
}

export function AddCategoryDialog({ open, onOpenChange, onAddCategory }: AddCategoryDialogProps) {
  const [titleIt, setTitleIt] = useState("")
  const [titleEn, setTitleEn] = useState("")
  const [loading, setLoading] = useState(false)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Categoria</DialogTitle>
          <DialogDescription>Crea una nuova categoria per organizzare le FAQ.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="catTitleIt">Titolo (Italiano)</Label>
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
            <Label htmlFor="catTitleEn">Titolo (Inglese - opzionale)</Label>
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
            {loading ? "Salvataggio..." : "Crea Categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
