"use client"

import { ArrowLeft, Check, LucidePencil, PlusIcon, Trash, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

interface FaqItem {
  id: string
  question: string
  answer: string
}

const initialFaqs: FaqItem[] = [
  { id: "1", question: "What is the price of a house?", answer: "1 million dollars" },
  { id: "2", question: "What is the price of a car?", answer: "100 thousand dollars" },
  { id: "3", question: "What is the price of a bike?", answer: "10 thousand dollars" },
  { id: "4", question: "What is the price of a boat?", answer: "100 million dollars" },
  { id: "5", question: "What is the price of a plane?", answer: "1 billion dollars" },
]

export default function WebFaqsIndex() {
  const [faqs, setFaqs] = useState<FaqItem[]>(initialFaqs)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState("")
  const [editAnswer, setEditAnswer] = useState("")
  const [openItems, setOpenItems] = useState<string[]>([])

  const handleCancel = (id: string) => {
    const item = faqs.find((f) => f.id === id)
    if (item && !item.question.trim() && !item.answer.trim()) {
      setFaqs((prev) => prev.filter((f) => f.id !== id))
    }
    setEditingId(null)
    setEditQuestion("")
    setEditAnswer("")
  }

  const saveCurrentIfValid = () => {
    if (!editingId) return
    const q = editQuestion.trim()
    const a = editAnswer.trim()

    if (q && a) {
      const currentId = editingId
      setFaqs((prev) => prev.map((f) => (f.id === currentId ? { ...f, question: q, answer: a } : f)))
    } else {
      handleCancel(editingId)
    }
  }

  const handleAdd = () => {
    saveCurrentIfValid()

    const newId = `faq-${Date.now()}`
    const newItem: FaqItem = { id: newId, question: "", answer: "" }

    setFaqs((prev) => [...prev, newItem])
    setEditingId(newId)
    setEditQuestion("")
    setEditAnswer("")
    setOpenItems((prev) => [...prev, newId])
  }

  const handleEdit = (e: React.MouseEvent, item: FaqItem) => {
    e.stopPropagation()
    if (editingId !== item.id) {
      saveCurrentIfValid()
    }
    setEditingId(item.id)
    setEditQuestion(item.question)
    setEditAnswer(item.answer)
    setOpenItems((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
  }

  const handleSave = (id: string) => {
    const q = editQuestion.trim()
    const a = editAnswer.trim()
    if (!q) return toast.error("Question cannot be empty.")
    if (!a) return toast.error("Answer cannot be empty.")

    setFaqs((prev) => prev.map((item) => (item.id === id ? { ...item, question: q, answer: a } : item)))
    setEditingId(null)
    setEditQuestion("")
    setEditAnswer("")
    toast.success("FAQ saved successfully.")
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setFaqs((prev) => prev.filter((item) => item.id !== id))
    setOpenItems((prev) => prev.filter((v) => v !== id))
    if (editingId === id) {
      setEditingId(null)
      setEditQuestion("")
      setEditAnswer("")
    }
    toast.success("FAQ deleted successfully.")
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="space-y-6">
        <div>
          <Link
            href="/dashboard/web"
            className="inline-flex gap-1 items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors group"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" /> Back
          </Link>
          <div className="flex justify-between items-center w-full">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/75 bg-clip-text text-transparent">
                Frequently Asked Questions
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Manage and view FAQs displayed on the web platform.
              </p>
            </div>
            <Button onClick={handleAdd}>
              <PlusIcon className="size-4" />
              Add FAQ
            </Button>
          </div>
        </div>

        <Accordion className="gap-3.5" value={openItems} onValueChange={setOpenItems} multiple>
          {faqs.map((item) => (
            <FaqAccordionItem
              key={item.id}
              item={item}
              isEditing={editingId === item.id}
              editQuestion={editQuestion}
              editAnswer={editAnswer}
              setEditQuestion={setEditQuestion}
              setEditAnswer={setEditAnswer}
              handleSave={handleSave}
              handleCancel={handleCancel}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
            />
          ))}
        </Accordion>
      </div>
    </div>
  )
}

interface FaqAccordionItemProps {
  item: FaqItem
  isEditing: boolean
  editQuestion: string
  editAnswer: string
  setEditQuestion: (val: string) => void
  setEditAnswer: (val: string) => void
  handleSave: (id: string) => void
  handleCancel: (id: string) => void
  handleEdit: (e: React.MouseEvent, item: FaqItem) => void
  handleDelete: (e: React.MouseEvent, id: string) => void
}

function FaqAccordionItem({
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
      value={item.id}
      className="group rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm px-5 py-0.5 transition-all duration-300 hover:border-primary/20 hover:bg-card/90 hover:shadow-md hover:shadow-primary/2 data-[open]:border-primary/30 data-[open]:bg-card data-[open]:shadow-md data-[open]:shadow-primary/5"
    >
      {isEditing ? (
        <FaqEditHeader
          id={item.id}
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
            id={item.id}
            answer={editAnswer}
            setAnswer={setEditAnswer}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <p>{item.answer}</p>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

interface FaqEditHeaderProps {
  id: string
  question: string
  setQuestion: (val: string) => void
  onSave: (id: string) => void
  onCancel: (id: string) => void
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
        <FaqButton icon={X} onClick={() => onCancel(id)} color="destructive" ariaLabel="Cancel edit" />
      </div>
    </div>
  )
}

interface FaqDisplayHeaderProps {
  item: FaqItem
  onEdit: (e: React.MouseEvent, item: FaqItem) => void
  onDelete: (e: React.MouseEvent, id: string) => void
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
                <FaqButton
                  icon={Trash}
                  onClick={(e) => e.stopPropagation()}
                  color="destructive"
                  ariaLabel="Delete FAQ"
                />
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
                  onDelete(e, item.id)
                }}
                color="destructive"
                ariaLabel="Confirm delete FAQ"
              />
              {/* <FaqButton icon={Undo} color="primary" ariaLabel="Cancel" /> */}
            </PopoverContent>
          </Popover>
        </div>
      }
    >
      {item.question}
    </AccordionTrigger>
  )
}

interface FaqEditContentProps {
  id: string
  answer: string
  setAnswer: (val: string) => void
  onSave: (id: string) => void
  onCancel: (id: string) => void
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

interface FaqButtonProps {
  icon: React.ComponentType<{ className?: string }>
  onClick?: (e: React.MouseEvent) => void
  color?: string
  ariaLabel?: string
}
function FaqButton({ icon: Icon, onClick, ariaLabel, color }: FaqButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-${color} hover:border-${color}/30 hover:bg-${color}/10 transition-all duration-200 cursor-pointer shadow-sm`}
    >
      <Icon className="size-3.5" />
    </Button>
  )
}
