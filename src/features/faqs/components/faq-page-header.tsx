import { FolderPlus, Plus } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"

export interface FAQPageHeaderProps {
  onOpenAddCategory: () => void
  onAddFAQ: () => void
  hasCategory: boolean
}

export function FAQPageHeader({ onOpenAddCategory, onAddFAQ, hasCategory }: FAQPageHeaderProps) {
  return (
    <PageHeader
      eyebrow="Web"
      title="Frequently asked questions"
      description="Manage the categories and FAQs displayed across the website."
      action={
        <div className="flex items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
          <Button variant="outline" onClick={onOpenAddCategory}>
            <FolderPlus data-icon="inline-start" /> Add category
          </Button>

          <Button onClick={onAddFAQ} disabled={!hasCategory}>
            <Plus data-icon="inline-start" /> Add FAQ
          </Button>
        </div>
      }
    />
  )
}
