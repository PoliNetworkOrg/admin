"use client" //Serve?

import { ArrowLeft, LucidePencil, PlusIcon, Trash } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

interface FaqsData {
  question: string
  answer: string
}

const data: FaqsData[] = [
  { question: "What is the price of a house?", answer: "1 million dollars" },
  { question: "What is the price of a car?", answer: "100 thousand dollars" },
  { question: "What is the price of a bike?", answer: "10 thousand dollars" },
  { question: "What is the price of a boat?", answer: "100 million dollars" },
  { question: "What is the price of a plane?", answer: "1 billion dollars" },
]

export default function WebFaqsIndex() {
  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    toast.info("Adding FAQ")
  }

  const handleEdit = (e: React.MouseEvent, question: string) => {
    e.stopPropagation()
    toast.warning(`Editing FAQ: "${question}"`)
  }

  const handleDelete = (e: React.MouseEvent, question: string) => {
    e.stopPropagation()
    toast.error(`Deleting FAQ: "${question}"`)
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

        <Accordion className="gap-3.5">
          {data.map((item, index) => (
            <AccordionItem
              key={index}
              value={index.toString()}
              className="group rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm px-5 py-0.5 transition-all duration-300 hover:border-primary/20 hover:bg-card/90 hover:shadow-md hover:shadow-primary/2 data-[open]:border-primary/30 data-[open]:bg-card data-[open]:shadow-md data-[open]:shadow-primary/5"
            >
              <AccordionTrigger
                className="font-medium text-foreground/90 transition-colors py-4 hover:no-underline group-hover:text-primary/90"
                actions={
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      onClick={(e) => handleEdit(e, item.question)}
                      aria-label="Edit FAQ"
                      className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent transition-all duration-200 cursor-pointer shadow-sm"
                    >
                      <LucidePencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleDelete(e, item.question)}
                      aria-label="Delete FAQ"
                      className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-all duration-200 cursor-pointer shadow-sm"
                    >
                      <Trash className="size-3.5" />
                    </Button>
                  </div>
                }
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                <p>{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
