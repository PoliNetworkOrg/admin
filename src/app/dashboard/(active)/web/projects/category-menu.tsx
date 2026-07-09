import { MoreHorizontalIcon } from "lucide-react"
import { PROJECT_CATEGORIES } from "@/app/dashboard/(active)/web/projects/constants"
import type { ProjectCategory } from "@/app/dashboard/(active)/web/projects/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ProjectCategoryMenu({
  category,
  onCategoryChange,
}: {
  category: ProjectCategory
  onCategoryChange: (category: ProjectCategory) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="icon" aria-label="Move project">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuRadioGroup value={category} onValueChange={(value) => onCategoryChange(value as ProjectCategory)}>
          {PROJECT_CATEGORIES.map((projectCategory) => (
            <DropdownMenuRadioItem key={projectCategory.value} value={projectCategory.value}>
              {projectCategory.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
