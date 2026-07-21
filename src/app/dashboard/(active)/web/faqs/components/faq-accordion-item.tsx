import { Check, LucidePencil, Trash, Undo2, X } from "lucide-react"
import type React from "react"
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { FAQItem } from "@/server/trpc/types"
import { FaqButton } from "./faq-button"

export interface FaqAccordionItemProps {
  item: FAQItem
  isEditing: boolean
  editQuestion: string
  editAnswer: string
  setEditQuestion: (val: string) => void
  setEditAnswer: (val: string) => void
  handleSave: (id: number) => void
  handleCancel: (id: number) => void
  handleEdit: (e: React.MouseEvent, item: FAQItem) => void
  handleDelete: (e: React.MouseEvent, id: number) => void
}

export function FaqAccordionItem({
  item,
  isEditing,
  editQuestion,
  editAnswer,
  setEditQuestion,
  setEditAnswer,
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
          question={editQuestion}
          setQuestion={setEditQuestion}
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
            answer={editAnswer}
            setAnswer={setEditAnswer}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <p>{item.descriptionIt}</p>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

interface FaqEditHeaderProps {
  id: number
  question: string
  setQuestion: (val: string) => void
  onSave: (id: number) => void
  onCancel: (id: number) => void
}

function FaqEditHeader({ id, question, setQuestion, onSave, onCancel }: FaqEditHeaderProps) {
  return (
    <div className="flex w-full items-center gap-2 py-4">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="flex-1 bg-transparent border-b border-border/80 focus:border-primary focus:outline-none py-1 text-sm font-medium text-foreground w-full mr-4 transition-colors placeholder:text-muted-foreground/50"
        placeholder="Scrivi la domanda..."
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(id)
          else if (e.key === "Escape") onCancel(id)
        }}
      />
      <div className="flex items-center gap-1.5 shrink-0">
        <FaqButton icon={Check} onClick={() => onSave(id)} color="emerald" ariaLabel="Save FAQ" />
        <FaqButton icon={Undo2} onClick={() => onCancel(id)} color="destructive" ariaLabel="Cancel edit" />
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
        <div className="flex items-center gap-1.5">
          <FaqButton icon={LucidePencil} onClick={(e) => onEdit(e, item)} color="primary" ariaLabel="Edit FAQ" />
          <Popover>
            <PopoverTrigger
              render={
                <FaqButton icon={X} onClick={(e) => e.stopPropagation()} color="destructive" ariaLabel="Delete FAQ" />
              }
            />
            <PopoverContent className="flex flex-row items-center gap-2" align="end">
              <PopoverHeader>
                <PopoverTitle className="text-primary-foreground">
                  Are you sure you want to delete this FAQ?
                </PopoverTitle>
              </PopoverHeader>
              <FaqButton
                icon={Trash}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(e, item.faqId)
                }}
                color="destructive"
                ariaLabel="Confirm delete FAQ"
              />
            </PopoverContent>
          </Popover>
        </div>
      }
    >
      {item.titleIt}
    </AccordionTrigger>
  )
}

interface FaqEditContentProps {
  id: number
  answer: string
  setAnswer: (val: string) => void
  onSave: (id: number) => void
  onCancel: (id: number) => void
}

function FaqEditContent({ id, answer, setAnswer, onSave, onCancel }: FaqEditContentProps) {
  return (
    <div className="space-y-2 mt-2">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full min-h-[120px] rounded-lg border border-border/80 bg-background/30 p-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y transition-all placeholder:text-muted-foreground/50"
        placeholder="Scrivi la risposta..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            onSave(id)
          } else if (e.key === "Escape") {
            onCancel(id)
          }
        }}
        // biome-ignore lint/a11y/noAutofocus: autoFocus is necessary for good UX when editing in-place (imo)
        autoFocus
      />
      <div className="flex justify-between items-center text-xs text-muted-foreground/80">
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
