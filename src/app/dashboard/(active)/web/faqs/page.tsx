"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { addFAQ, addFAQCategory, deleteFAQ, deleteFAQCategory, editFAQ, listFAQs } from "@/server/actions/faqs"
import type { FAQItem, FAQs } from "@/server/trpc/types"
import { AddCategoryDialog } from "./components/add-category-dialog"
import { CategorySwitcher } from "./components/category-switcher"
import { FaqAccordionList } from "./components/faq-accordion-list"
import { FaqPageHeader } from "./components/faq-page-header"

export default function WebFaqsIndex() {
  const [faqs, setFaqs] = useState<FAQs>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQuestion, setEditQuestion] = useState("")
  const [editAnswer, setEditAnswer] = useState("")
  const [openItems, setOpenItems] = useState<number[]>([])
  const [unsavedIds, setUnsavedIds] = useState<number[]>([])

  // State for Add Category Dialog
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  useEffect(() => {
    listFAQs()
      .then((f) => {
        setFaqs(f)
        if (f.length > 0 && f[0]) {
          const firstId = f[0].categoryId
          setCategoryId((prev) => (prev && f.some((c) => c.categoryId === prev) ? prev : firstId))
        }
      })
      .catch((e: string) => toast.error(`Failed to fetch FAQs: ${e}`))
  }, [])

  const handleAddCategory = async (titleIt: string, titleEn: string) => {
    try {
      const res = await addFAQCategory({
        titleIt,
        titleEn: titleEn || titleIt,
      })

      const newCat = {
        categoryId: res.id,
        titleIt: res.titleIt,
        titleEn: res.titleEn,
        icon: res.icon ?? null,
        faqs: [],
      }

      setFaqs((prev) => [...prev, newCat])
      setCategoryId(res.id)
      toast.success("Categoria creata con successo!")
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Errore durante la creazione della categoria: ${errorMessage}`)
      throw e
    }
  }

  const handleDeleteCategory = async (catId: number) => {
    try {
      await deleteFAQCategory({ id: catId })
      setFaqs((prev) => {
        const next = prev.filter((c) => c.categoryId !== catId)
        if (categoryId === catId) {
          setCategoryId(next[0]?.categoryId ?? null)
        }
        return next
      })
      toast.success("Categoria eliminata con successo.")
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Errore durante l'eliminazione della categoria: ${errorMessage}`)
    }
  }

  const handleAdd = () => {
    if (!categoryId) {
      toast.error("Seleziona o crea prima una categoria.")
      setIsAddCategoryOpen(true)
      return
    }

    saveCurrentIfValid()

    const newId = Math.max(0, ...faqs.flatMap((faq) => faq.faqs.map((item) => item.faqId))) + 1
    const newItem: FAQItem = {
      faqId: newId,
      titleIt: editQuestion,
      titleEn: editQuestion,
      descriptionIt: editAnswer,
      descriptionEn: editAnswer,
    }

    setFaqs((prev) =>
      prev.map((faq) => {
        if (faq.categoryId === categoryId) {
          return {
            ...faq,
            faqs: [...faq.faqs, newItem],
          }
        }
        return faq
      })
    )

    setUnsavedIds((prev) => [...prev, newId])
    setEditingId(newId)
    setEditQuestion("")
    setEditAnswer("")
    setOpenItems((prev) => [...prev, newId])
  }

  const handleEdit = (e: React.MouseEvent, item: FAQItem) => {
    e.stopPropagation()
    if (editingId !== item.faqId) {
      saveCurrentIfValid()
    }
    setEditingId(item.faqId)
    setEditQuestion(item.titleIt)
    setEditAnswer(item.descriptionIt)
    setOpenItems((prev) => (prev.includes(item.faqId) ? prev : [...prev, item.faqId]))
  }

  const handleSave = (id: number) => {
    if (!categoryId) return
    const q = editQuestion.trim()
    const a = editAnswer.trim()
    if (!q) return toast.error("Question cannot be empty.")
    if (!a) return toast.error("Answer cannot be empty.")

    const isNew = unsavedIds.includes(id)
    const savePromise = isNew
      ? addFAQ({ question: q, answer: a, categoryId })
      : editFAQ({ id, question: q, answer: a, categoryId })

    savePromise
      .then(() => {
        setFaqs((prev) =>
          prev.map((faq) => {
            if (faq.categoryId === categoryId) {
              return {
                ...faq,
                faqs: faq.faqs.map((item) => {
                  if (item.faqId === id) {
                    return {
                      ...item,
                      faqId: id,
                      titleIt: q,
                      titleEn: q,
                      descriptionIt: a,
                      descriptionEn: a,
                    }
                  }
                  return item
                }),
              }
            }
            return faq
          })
        )
        setUnsavedIds((prev) => prev.filter((x) => x !== id))
        setEditingId(null)
        setEditQuestion("")
        setEditAnswer("")
        toast.success("FAQ saved successfully.")
      })
      .catch((e: string) => toast.error(`Failed to save FAQ: ${e}`))
  }

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()

    const isNew = unsavedIds.includes(id)
    const deletePromise = isNew ? Promise.resolve() : deleteFAQ({ id })

    deletePromise
      .then(() => {
        setFaqs((prev) =>
          prev.map((faq) => {
            if (faq.categoryId === categoryId) {
              return {
                ...faq,
                faqs: faq.faqs.filter((item) => item.faqId !== id),
              }
            }
            return faq
          })
        )

        setUnsavedIds((prev) => prev.filter((x) => x !== id))
        setOpenItems((prev) => prev.filter((v) => v !== id))
        if (editingId === id) {
          setEditingId(null)
          setEditQuestion("")
          setEditAnswer("")
        }
        toast.success("FAQ deleted successfully.")
      })
      .catch((e: string) => toast.error(`Failed to delete FAQ: ${e}`))
  }

  const handleCancel = (id: number) => {
    const item = faqs?.flatMap((f) => f.faqs).find((f) => f.faqId === id)
    if (item && !item.titleIt.trim() && !item.descriptionIt.trim()) {
      setFaqs((prev) =>
        prev.map((faq) => {
          if (faq.categoryId === categoryId) {
            return {
              ...faq,
              faqs: faq.faqs.filter((item) => item.faqId !== id),
            }
          }
          return faq
        })
      )
      setUnsavedIds((prev) => prev.filter((x) => x !== id))
    }
    setEditingId(null)
    setEditQuestion("")
    setEditAnswer("")
  }

  const saveCurrentIfValid = () => {
    if (!editingId || !categoryId) return
    const q = editQuestion.trim()
    const a = editAnswer.trim()

    if (q && a) {
      const currentId = editingId
      const isNew = unsavedIds.includes(currentId)
      const savePromise = isNew
        ? addFAQ({ question: q, answer: a, categoryId })
        : editFAQ({ id: currentId, question: q, answer: a, categoryId })

      savePromise
        .then(() => {
          setFaqs((prev) =>
            prev.map((faq) => {
              if (faq.categoryId === categoryId) {
                return {
                  ...faq,
                  faqs: faq.faqs.map((item) => {
                    if (item.faqId === currentId) {
                      return {
                        ...item,
                        faqId: currentId,
                        titleIt: q,
                        titleEn: q,
                        descriptionIt: a,
                        descriptionEn: a,
                      }
                    }
                    return item
                  }),
                }
              }
              return faq
            })
          )
          setUnsavedIds((prev) => prev.filter((x) => x !== currentId))
          toast.success("Previous FAQ saved successfully.")
        })
        .catch((e: string) => toast.error(`Failed to auto-save previous FAQ: ${e}`))
    } else {
      handleCancel(editingId)
    }
  }

  const activeCategory = faqs.find((c) => c.categoryId === categoryId)
  const currentCategoryFaqs = activeCategory?.faqs ?? []

  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="space-y-6 w-full">
        <FaqPageHeader
          onOpenAddCategory={() => setIsAddCategoryOpen(true)}
          onAddFaq={handleAdd}
          hasCategory={!!categoryId}
        />

        <CategorySwitcher
          categories={faqs}
          activeCategoryId={categoryId}
          onSelectCategory={(id: React.SetStateAction<number | null>) => {
            saveCurrentIfValid()
            setCategoryId(id)
          }}
          onDeleteCategory={handleDeleteCategory}
        />

        <FaqAccordionList
          items={currentCategoryFaqs}
          editingId={editingId}
          openItems={openItems}
          setOpenItems={setOpenItems}
          editQuestion={editQuestion}
          editAnswer={editAnswer}
          setEditQuestion={setEditQuestion}
          setEditAnswer={setEditAnswer}
          handleSave={handleSave}
          handleCancel={handleCancel}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleAdd={handleAdd}
          hasCategory={!!categoryId}
        />

        <AddCategoryDialog
          open={isAddCategoryOpen}
          onOpenChange={setIsAddCategoryOpen}
          onAddCategory={handleAddCategory}
        />
      </div>
    </div>
  )
}
