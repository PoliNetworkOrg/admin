import Link from "next/link"
import { FiArrowLeft, FiFolderPlus, FiPlus } from "react-icons/fi"
import { Button } from "@/components/ui/button"

export interface FaqPageHeaderProps {
  onOpenAddCategory: () => void
  onAddFaq: () => void
  hasCategory: boolean
}

export function FaqPageHeader({ onOpenAddCategory, onAddFaq, hasCategory }: FaqPageHeaderProps) {
  return (
    <div>
      <Link
        href="/dashboard/web"
        className="inline-flex gap-1 items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors group"
      >
        <FiArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" /> Back
      </Link>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage and view FAQs displayed on the web platform by category.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenAddCategory}>
            <FiFolderPlus className="size-4" />
            Nuova Categoria
          </Button>

          <Button onClick={onAddFaq} disabled={!hasCategory}>
            <FiPlus className="size-4" />
            Add FAQ
          </Button>
        </div>
      </div>
    </div>
  )
}
