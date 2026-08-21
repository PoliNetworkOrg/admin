import { HelpCircle, Plus } from "lucide-react"
import type React from "react"
import { EmptyState } from "@/components/empty-state"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import type { FAQItem } from "@/lib/api/types"
import { FaqAccordionItem } from "./faq-accordion-item"

export interface FaqAccordionListProps {
  items: FAQItem[]
  editingId: number | null
  openItems: number[]
  setOpenItems: React.Dispatch<React.SetStateAction<number[]>>
  editQuestionIt: string
  editQuestionEn: string
  editAnswerIt: string
  editAnswerEn: string
  setEditQuestionIt: (val: string) => void
  setEditQuestionEn: (val: string) => void
  setEditAnswerIt: (val: string) => void
  setEditAnswerEn: (val: string) => void
  handleSave: (id: number) => void
  handleCancel: (id: number) => void
  handleEdit: (e: React.MouseEvent, item: FAQItem) => void
  handleDelete: (e: React.MouseEvent, id: number) => void
  handleAdd: () => void
  hasCategory: boolean
}

export function FaqAccordionList({
  items,
  editingId,
  openItems,
  setOpenItems,
  editQuestionIt,
  editQuestionEn,
  editAnswerIt,
  editAnswerEn,
  setEditQuestionIt,
  setEditQuestionEn,
  setEditAnswerIt,
  setEditAnswerEn,
  handleSave,
  handleCancel,
  handleEdit,
  handleDelete,
  handleAdd,
  hasCategory,
}: FaqAccordionListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={HelpCircle}
        title={hasCategory ? "No FAQs in this category" : "No category selected"}
        text={
          hasCategory
            ? "Add the first question and answer to this category."
            : "Select an existing category or create a new one to view and manage its FAQs."
        }
        action={
          hasCategory ? (
            <Button onClick={handleAdd}>
              <Plus data-icon="inline-start" /> Add first FAQ
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <Accordion className="gap-3.5" value={openItems} onValueChange={setOpenItems} multiple>
      {items.map((item, index) => (
        <FaqAccordionItem
          key={`${item.faqId}-${index}`}
          item={item}
          isEditing={editingId === item.faqId}
          editQuestionIt={editQuestionIt}
          editQuestionEn={editQuestionEn}
          editAnswerIt={editAnswerIt}
          editAnswerEn={editAnswerEn}
          setEditQuestionIt={setEditQuestionIt}
          setEditQuestionEn={setEditQuestionEn}
          setEditAnswerIt={setEditAnswerIt}
          setEditAnswerEn={setEditAnswerEn}
          handleSave={handleSave}
          handleCancel={handleCancel}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
        />
      ))}
    </Accordion>
  )
}
