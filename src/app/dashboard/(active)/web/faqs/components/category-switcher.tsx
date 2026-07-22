import { FiEdit, FiTrash2 } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FAQs } from "@/server/trpc/types"

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
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-primary hover:bg-primary/10"
              title="Modifica categoria"
              onClick={() => onEditCategory(activeCategory)}
            >
              <FiEdit className="size-3.5" />
            </Button>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Elimina categoria"
                >
                  <FiTrash2 className="size-3.5" />
                </Button>
              }
            />
            <PopoverContent className="w-72 space-y-3 p-4" align="end">
              <PopoverHeader>
                <PopoverTitle className="text-sm font-semibold text-foreground">
                  Eliminare "{activeCategory.titleIt}"?
                </PopoverTitle>
              </PopoverHeader>
              <p className="text-xs text-muted-foreground">
                Questa azione eliminerà la categoria e tutte le FAQ associate ad essa.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="destructive" onClick={() => onDeleteCategory(activeCategory.categoryId)}>
                  Conferma Eliminazione
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}
