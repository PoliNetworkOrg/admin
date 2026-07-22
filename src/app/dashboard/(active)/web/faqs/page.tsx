"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  addFAQ,
  addFAQCategory,
  deleteFAQ,
  deleteFAQCategory,
  editFAQ,
  editFAQCategory,
  listFAQs,
} from "@/server/actions/faqs"
import type { FAQItem, FAQs } from "@/server/trpc/types"
import { AddCategoryDialog } from "./components/add-category-dialog"
import { CategorySwitcher } from "./components/category-switcher"
import { FaqAccordionList } from "./components/faq-accordion-list"
import { FaqPageHeader } from "./components/faq-page-header"

export default function WebFaqsIndex() {
  const [faqs, setFaqs] = useState<FAQs>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [editQuestionIt, setEditQuestionIt] = useState("")
  const [editQuestionEn, setEditQuestionEn] = useState("")
  const [editAnswerIt, setEditAnswerIt] = useState("")
  const [editAnswerEn, setEditAnswerEn] = useState("")

  const [openItems, setOpenItems] = useState<number[]>([])
  const [unsavedIds, setUnsavedIds] = useState<number[]>([])

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<FAQs[number] | null>(null)

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

  const handleUpdateCategory = async (catId: number, titleIt: string, titleEn: string) => {
    try {
      const res = await editFAQCategory({
        id: catId,
        titleIt,
        titleEn: titleEn || titleIt,
      })

      if ("error" in res) {
        toast.error(`Errore: ${res.error}`)
        return
      }

      setFaqs((prev) =>
        prev.map((c) => (c.categoryId === catId ? { ...c, titleIt: res.titleIt, titleEn: res.titleEn } : c))
      )
      toast.success("Categoria aggiornata con successo!")
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Errore durante la modifica della categoria: ${errorMessage}`)
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
      titleIt: editQuestionIt,
      titleEn: editQuestionEn || editQuestionIt,
      descriptionIt: editAnswerIt,
      descriptionEn: editAnswerEn || editAnswerIt,
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
    setEditQuestionIt("")
    setEditQuestionEn("")
    setEditAnswerIt("")
    setEditAnswerEn("")
    setOpenItems((prev) => [...prev, newId])
  }

  const handleEdit = (e: React.MouseEvent, item: FAQItem) => {
    e.stopPropagation()
    if (editingId !== item.faqId) {
      saveCurrentIfValid()
    }
    setEditingId(item.faqId)
    setEditQuestionIt(item.titleIt)
    setEditQuestionEn(item.titleEn ?? "")
    setEditAnswerIt(item.descriptionIt)
    setEditAnswerEn(item.descriptionEn ?? "")
    setOpenItems((prev) => (prev.includes(item.faqId) ? prev : [...prev, item.faqId]))
  }

  const handleSave = (id: number) => {
    if (!categoryId) return
    const qIt = editQuestionIt.trim()
    const qEn = editQuestionEn.trim() || qIt
    const aIt = editAnswerIt.trim()
    const aEn = editAnswerEn.trim() || aIt

    if (!qIt) return toast.error("Domanda (Italiano) obbligatoria.")
    if (!aIt) return toast.error("Risposta (Italiano) obbligatoria.")

    const isNew = unsavedIds.includes(id)
    const savePromise = isNew
      ? addFAQ({ questionIt: qIt, questionEn: qEn, answerIt: aIt, answerEn: aEn, categoryId })
      : editFAQ({ id, questionIt: qIt, questionEn: qEn, answerIt: aIt, answerEn: aEn, categoryId })

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
                      titleIt: qIt,
                      titleEn: qEn,
                      descriptionIt: aIt,
                      descriptionEn: aEn,
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
        setEditQuestionIt("")
        setEditQuestionEn("")
        setEditAnswerIt("")
        setEditAnswerEn("")
        toast.success("FAQ salvata con successo.")
      })
      .catch((e: string) => toast.error(`Impossibile salvare la FAQ: ${e}`))
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
          setEditQuestionIt("")
          setEditQuestionEn("")
          setEditAnswerIt("")
          setEditAnswerEn("")
        }
        toast.success("FAQ eliminata con successo.")
      })
      .catch((e: string) => toast.error(`Impossibile eliminare la FAQ: ${e}`))
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
    setEditQuestionIt("")
    setEditQuestionEn("")
    setEditAnswerIt("")
    setEditAnswerEn("")
  }

  const saveCurrentIfValid = () => {
    if (!editingId || !categoryId) return
    const qIt = editQuestionIt.trim()
    const qEn = editQuestionEn.trim() || qIt
    const aIt = editAnswerIt.trim()
    const aEn = editAnswerEn.trim() || aIt

    if (qIt && aIt) {
      const currentId = editingId
      const isNew = unsavedIds.includes(currentId)
      const savePromise = isNew
        ? addFAQ({ questionIt: qIt, questionEn: qEn, answerIt: aIt, answerEn: aEn, categoryId })
        : editFAQ({ id: currentId, questionIt: qIt, questionEn: qEn, answerIt: aIt, answerEn: aEn, categoryId })

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
                        titleIt: qIt,
                        titleEn: qEn,
                        descriptionIt: aIt,
                        descriptionEn: aEn,
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
          toast.success("FAQ precedente salvata con successo.")
        })
        .catch((e: string) => toast.error(`Impossibile salvare la FAQ precedente: ${e}`))
    } else {
      handleCancel(editingId)
    }
  }

  const activeCategory = faqs.find((c) => c.categoryId === categoryId)
  const currentCategoryFaqs = activeCategory?.faqs ?? []

  return (
    <div className="mx-auto max-w-sm md:max-w-full py-10">
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
          onEditCategory={(cat) => {
            setEditingCategory(cat)
            setIsEditCategoryOpen(true)
          }}
        />

        <FaqAccordionList
          items={currentCategoryFaqs}
          editingId={editingId}
          openItems={openItems}
          setOpenItems={setOpenItems}
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
          handleAdd={handleAdd}
          hasCategory={!!categoryId}
        />

        <AddCategoryDialog
          open={isAddCategoryOpen}
          onOpenChange={setIsAddCategoryOpen}
          onAddCategory={handleAddCategory}
        />

        {editingCategory && (
          <AddCategoryDialog
            open={isEditCategoryOpen}
            onOpenChange={setIsEditCategoryOpen}
            mode="edit"
            initialTitleIt={editingCategory.titleIt}
            initialTitleEn={editingCategory.titleEn ?? ""}
            onAddCategory={async (titleIt, titleEn) => {
              await handleUpdateCategory(editingCategory.categoryId, titleIt, titleEn)
            }}
          />
        )}
      </div>
    </div>
  )
}
