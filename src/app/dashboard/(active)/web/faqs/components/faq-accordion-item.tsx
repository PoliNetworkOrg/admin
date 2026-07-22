import type React from "react"
import { FiCheck, FiCornerDownLeft, FiEdit } from "react-icons/fi"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type { FAQItem } from "@/server/trpc/types"
import { DeletePopover } from "./delete-popover"
import { FaqButton } from "./faq-button"

export interface FaqAccordionItemProps {
  item: FAQItem
  isEditing: boolean
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
}

export function FaqAccordionItem({
  item,
  isEditing,
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
}: FaqAccordionItemProps) {
  return (
    <AccordionItem
      value={item.faqId}
      className="group rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm px-5 py-0.5 transition-all duration-300 hover:border-primary/20 hover:bg-card/90 hover:shadow-md hover:shadow-primary/2 data-[open]:border-primary/30 data-[open]:bg-card data-[open]:shadow-md data-[open]:shadow-primary/5"
    >
      {isEditing ? (
        <FaqEditHeader
          id={item.faqId}
          questionIt={editQuestionIt}
          questionEn={editQuestionEn}
          setQuestionIt={setEditQuestionIt}
          setQuestionEn={setEditQuestionEn}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <FaqDisplayHeader item={item} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
        {isEditing ? (
          <FaqEditContent
            id={item.faqId}
            answerIt={editAnswerIt}
            answerEn={editAnswerEn}
            setAnswerIt={setEditAnswerIt}
            setAnswerEn={setEditAnswerEn}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span role="img" aria-label="Italiano" className="text-sm leading-none">
                  🇮🇹
                </span>
              </div>
              <p className="text-foreground/90">A: {item.descriptionIt}</p>
            </div>
            {item.descriptionEn && (
              <div className="pt-2 border-t border-border/40">
                <div className="flex items-center gap-1.5 mb-1">
                  <span role="img" aria-label="English" className="text-sm leading-none">
                    🇬🇧
                  </span>
                </div>
                <p className="text-foreground/90">A: {item.descriptionEn}</p>
              </div>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

interface FaqEditHeaderProps {
  id: number
  questionIt: string
  questionEn: string
  setQuestionIt: (val: string) => void
  setQuestionEn: (val: string) => void
  onSave: (id: number) => void
  onCancel: (id: number) => void
}

function FaqEditHeader({
  id,
  questionIt,
  questionEn,
  setQuestionIt,
  setQuestionEn,
  onSave,
  onCancel,
}: FaqEditHeaderProps) {
  return (
    <div className="flex w-full items-start gap-3 py-3">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span role="img" aria-label="Italiano" className="text-base shrink-0 leading-none">
            🇮🇹
          </span>
          <input
            type="text"
            value={questionIt}
            onChange={(e) => setQuestionIt(e.target.value)}
            className="flex-1 bg-transparent border-b border-border/80 focus:border-primary focus:outline-none py-1 text-sm font-medium text-foreground w-full transition-colors placeholder:text-muted-foreground/50"
            placeholder="Domanda (Italiano)..."
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave(id)
              else if (e.key === "Escape") onCancel(id)
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span role="img" aria-label="English" className="text-base shrink-0 leading-none">
            🇬🇧
          </span>
          <input
            type="text"
            value={questionEn}
            onChange={(e) => setQuestionEn(e.target.value)}
            className="flex-1 bg-transparent border-b border-border/80 focus:border-primary focus:outline-none py-1 text-sm font-medium text-foreground w-full transition-colors placeholder:text-muted-foreground/50"
            placeholder="Question (English)..."
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave(id)
              else if (e.key === "Escape") onCancel(id)
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 pt-1">
        <FaqButton icon={FiCheck} onClick={() => onSave(id)} color="emerald" ariaLabel="Save FAQ" />
        <FaqButton icon={FiCornerDownLeft} onClick={() => onCancel(id)} color="destructive" ariaLabel="Cancel edit" />
      </div>
    </div>
  )
}

interface FaqDisplayHeaderProps {
  item: FAQItem
  onEdit: (e: React.MouseEvent, item: FAQItem) => void
  onDelete: (e: React.MouseEvent, id: number) => void
}

function FaqDisplayHeader({ item, onEdit, onDelete }: FaqDisplayHeaderProps) {
  return (
    <AccordionTrigger
      className="font-medium text-foreground/90 transition-colors py-4 hover:no-underline group-hover:text-primary"
      actions={
        <div className="flex text-xs items-center gap-1.5">
          <FaqButton icon={FiEdit} onClick={(e) => onEdit(e, item)} color="primary" ariaLabel="Edit FAQ" />
          <DeletePopover
            title="Eliminare questa FAQ?"
            triggerAriaLabel="Delete FAQ"
            triggerOnClick={(e) => e.stopPropagation()}
            onConfirm={(e) => onDelete(e, item.faqId)}
          />
        </div>
      }
    >
      <div className="flex flex-col text-left">
        <span className="font-semibold flex items-center gap-2">
          <span role="img" aria-label="Italiano" className="text-sm leading-none">
            🇮🇹
          </span>
          Q: {item.titleIt}
        </span>
        {item.titleEn && item.titleEn !== item.titleIt && (
          <span className="text-xs font-normal text-muted-foreground mt-0.5 flex items-center gap-2">
            <span role="img" aria-label="English" className="text-xs leading-none">
              🇬🇧
            </span>
            Q: {item.titleEn}
          </span>
        )}
      </div>
    </AccordionTrigger>
  )
}

interface FaqEditContentProps {
  id: number
  answerIt: string
  answerEn: string
  setAnswerIt: (val: string) => void
  setAnswerEn: (val: string) => void
  onSave: (id: number) => void
  onCancel: (id: number) => void
}

function FaqEditContent({ id, answerIt, answerEn, setAnswerIt, setAnswerEn, onSave, onCancel }: FaqEditContentProps) {
  return (
    <div className="space-y-3 mt-2">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span role="img" aria-label="Italiano" className="text-sm leading-none">
            🇮🇹
          </span>
          <span className="text-xs font-medium text-muted-foreground">Risposta (Italiano)</span>
        </div>
        <textarea
          value={answerIt}
          onChange={(e) => setAnswerIt(e.target.value)}
          className="w-full min-h-[80px] rounded-lg border border-border/80 bg-background/30 p-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y transition-all placeholder:text-muted-foreground/50"
          placeholder="Risposta in italiano..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              onSave(id)
            } else if (e.key === "Escape") {
              onCancel(id)
            }
          }}
          // biome-ignore lint/a11y/noAutofocus: autoFocus is necessary for good UX when editing in-place
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span role="img" aria-label="English" className="text-sm leading-none">
            🇬🇧
          </span>
          <span className="text-xs font-medium text-muted-foreground">Answer (English)</span>
        </div>
        <textarea
          value={answerEn}
          onChange={(e) => setAnswerEn(e.target.value)}
          className="w-full min-h-[80px] rounded-lg border border-border/80 bg-background/30 p-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y transition-all placeholder:text-muted-foreground/50"
          placeholder="Answer in English..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              onSave(id)
            } else if (e.key === "Escape") {
              onCancel(id)
            }
          }}
        />
      </div>

      <div className="flex justify-between items-center text-xs text-muted-foreground/80 pt-1">
        <span>
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-xs font-sans">Ctrl + Enter</kbd> to
          save, <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-xs font-sans">Esc</kbd> to
          cancel
        </span>
      </div>
    </div>
  )
}
