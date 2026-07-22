import { FiEdit } from "react-icons/fi"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FAQs } from "@/server/trpc/types"
import { DeletePopover } from "./delete-popover"
import { FaqButton } from "./faq-button"

export interface CategorySwitcherProps {
  categories: FAQs
  activeCategoryId: number | null
  onSelectCategory: (id: number) => void
  onDeleteCategory: (id: number) => void
  onEditCategory?: (category: FAQs[number]) => void
}

export function CategorySwitcher({
  categories,
  activeCategoryId,
  onSelectCategory,
  onDeleteCategory,
  onEditCategory,
}: CategorySwitcherProps) {
  const activeCategory = categories.find((c) => c.categoryId === activeCategoryId)
  const categoryOptions = categories.map((c) => ({
    value: String(c.categoryId),
    label: `🇮🇹 ${c.titleIt}`,
  }))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Categoria:</span>
        {categories.length > 0 ? (
          <Select
            items={categoryOptions}
            value={activeCategoryId ? String(activeCategoryId) : undefined}
            onValueChange={(val) => {
              if (val) onSelectCategory(Number(val))
            }}
          >
            <SelectTrigger className="w-fit">
              <SelectValue placeholder="Seleziona categoria" />
            </SelectTrigger>
            <SelectContent className="w-fit">
              <SelectGroup>
                {categories.map((cat) => (
                  <SelectItem key={cat.categoryId} value={String(cat.categoryId)} className="py-2 leading-none">
                    <span className="font-medium">🇮🇹 {cat.titleIt}</span>
                    {cat.titleEn && cat.titleEn !== cat.titleIt && (
                      <span className="text-xs text-muted-foreground">/ 🇬🇧 {cat.titleEn}</span>
                    )}
                    <span className="text-xs text-muted-foreground">({cat.faqs.length})</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground italic">Nessuna categoria presente.</span>
        )}
      </div>

      {activeCategory && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{activeCategory.faqs.length} FAQ in questa categoria</span>
          {onEditCategory && (
            <FaqButton
              icon={FiEdit}
              onClick={() => onEditCategory(activeCategory)}
              color="primary"
              ariaLabel="Modifica categoria"
            />
          )}
          <DeletePopover
            title={`Eliminare "${activeCategory.titleIt}"?`}
            description="Questa azione eliminerà la categoria e tutte le FAQ associate ad essa."
            triggerAriaLabel="Elimina categoria"
            onConfirm={() => onDeleteCategory(activeCategory.categoryId)}
          />
        </div>
      )}
    </div>
  )
}
