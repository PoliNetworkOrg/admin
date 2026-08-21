import { Edit } from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FAQs } from "@/lib/api/types"
import { DeletePopover } from "./delete-popover"
import { FaqButton } from "./faq-button"
import { FaqCategoryIcon } from "./faq-icon"

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
    label: `${c.titleIt}`,
  }))

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(15_23_42/4%)] dark:shadow-none">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Category:</span>
        {categories.length > 0 ? (
          <div className="flex items-center gap-2">
            <Select
              items={categoryOptions}
              value={activeCategoryId ? String(activeCategoryId) : undefined}
              onValueChange={(val) => {
                if (val) onSelectCategory(Number(val))
              }}
            >
              <SelectTrigger className="w-fit">
                {activeCategory?.icon && (
                  <FaqCategoryIcon name={activeCategory.icon} className="size-4.5 text-foreground shrink-0" />
                )}
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="w-fit">
                <SelectGroup>
                  {categories.map((cat) => (
                    <SelectItem key={cat.categoryId} value={String(cat.categoryId)} className="py-2 leading-none">
                      {cat.icon && (
                        <FaqCategoryIcon name={cat.icon} className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium">{cat.titleIt}</span>
                      {cat.titleEn && <span className="text-xs text-muted-foreground">/ {cat.titleEn}</span>}
                      <span className="text-xs text-muted-foreground">({cat.faqs.length})</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">No categories available.</span>
        )}
      </div>

      {activeCategory && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {activeCategory.faqs.length} FAQ{activeCategory.faqs.length !== 1 ? "s" : ""} in this category
          </span>
          {onEditCategory && (
            <FaqButton
              icon={Edit}
              onClick={() => onEditCategory(activeCategory)}
              color="primary"
              ariaLabel="Edit category"
            />
          )}
          <DeletePopover
            title={`Delete "${activeCategory.titleIt}"?`}
            description="This action will delete the category and all FAQs associated with it."
            triggerAriaLabel="Delete category"
            onConfirm={() => onDeleteCategory(activeCategory.categoryId)}
          />
        </div>
      )}
    </div>
  )
}
