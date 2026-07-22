import type React from "react"
import { FiPlus } from "react-icons/fi"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import type { FAQItem } from "@/server/trpc/types"
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
      <div className="py-12 text-center rounded-xl border border-dashed border-border bg-card/30">
        <p className="text-muted-foreground text-sm">
          {hasCategory
            ? "Nessuna FAQ in questa categoria."
            : "Nessuna categoria selezionata. Crea o seleziona una categoria per visualizzare le FAQ."}
        </p>
        {hasCategory && (
          <Button variant="outline" size="sm" onClick={handleAdd} className="mt-3">
            <FiPlus className="size-4" /> Aggiungi FAQ
          </Button>
        )}
      </div>
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
