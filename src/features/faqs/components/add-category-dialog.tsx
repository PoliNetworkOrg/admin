import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { DEFAULT_FAQ_ICON, FAQCategoryIcon, UNIVERSITY_FAQ_ICONS } from "./faq-icon"
import { LanguageBadge } from "./language-badge"

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
    if (!trimmedIt || !trimmedEn) return toast.error("Category titles cannot be empty.")

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
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5 flex gap-2">
            <Label htmlFor="catIcon">Icon:</Label>

            <Select
              value={icon}
              onValueChange={(val) => {
                if (val) setIcon(val)
              }}
            >
              <SelectTrigger id="catIcon">
                <SelectValue placeholder="Select an icon">
                  <FAQCategoryIcon name={icon} className="size-4" />
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
                      <FAQCategoryIcon name={name} className="size-5 mx-auto" />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <LanguageBadge lang="it" />
            <Input
              id="catTitleIt"
              placeholder="e.g. Generali, Iscrizioni, Corsi..."
              value={titleIt}
              onChange={(e) => setTitleIt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <LanguageBadge lang="en" />
            <Input
              id="catTitleEn"
              placeholder="e.g. General, Enrollment..."
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubmit()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSubmit} disabled={loading || !titleIt.trim()}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
