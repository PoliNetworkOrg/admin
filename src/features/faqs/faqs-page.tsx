"use client"

import { useServerFn } from "@tanstack/react-start"
import type React from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import type { FAQItem, FAQs } from "@/lib/api/types.ts"

import { AddCategoryDialog } from "./components/add-category-dialog"
import { CategorySwitcher } from "./components/category-switcher"
import { FAQAccordionList } from "./components/faq-accordion-list"
import { FAQPageHeader } from "./components/faq-page-header"
import { addFAQ, addFAQCategory, deleteFAQ, deleteFAQCategory, editFAQ, editFAQCategory } from "./faqs.functions"

export default function FAQsPage({ initFAQs }: { initFAQs: FAQs }) {
  const addFAQFn = useServerFn(addFAQ)
  const addFAQCategoryFn = useServerFn(addFAQCategory)
  const editFAQFn = useServerFn(editFAQ)
  const editFAQCategoryFn = useServerFn(editFAQCategory)
  const deleteFAQFn = useServerFn(deleteFAQ)
  const deleteFAQCategoryFn = useServerFn(deleteFAQCategory)

  const [faqs, setFAQs] = useState<FAQs>([])
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
    setFAQs(initFAQs)
    if (initFAQs.length > 0 && initFAQs[0]) {
      const firstId = initFAQs[0].categoryId
      setCategoryId((prev) => (prev && initFAQs.some((c: FAQs[0]) => c.categoryId === prev) ? prev : firstId))
    }
  }, [initFAQs])

  const handleAddCategory = async (titleIt: string, titleEn: string, icon?: string) => {
    try {
      const res = await addFAQCategoryFn({
        data: {
          titleIt: titleIt,
          titleEn: titleEn,
          icon: icon,
        },
      })

      const newCat = {
        categoryId: res.id,
        titleIt: res.titleIt,
        titleEn: res.titleEn,
        icon: res.icon ?? null,
        faqs: [],
      }

      setFAQs((prev) => [...prev, newCat])
      setCategoryId(res.id)
      toast.success("Category created successfully!")
    } catch (e: unknown) {
      console.error(e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to create category: ${errorMessage}`)
      throw e
    }
  }

  const handleUpdateCategory = async (catId: number, titleIt: string, titleEn: string, icon?: string | null) => {
    try {
      const res = await editFAQCategoryFn({
        data: {
          id: catId,
          titleIt: titleIt,
          titleEn: titleEn,
          icon: icon ?? null,
        },
      })

      setFAQs((prev) =>
        prev.map((c) =>
          c.categoryId === catId ? { ...c, titleIt: res.titleIt, titleEn: res.titleEn, icon: res.icon ?? null } : c
        )
      )
      toast.success("Category updated successfully!")
    } catch (e: unknown) {
      console.error(e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to update category: ${errorMessage}`)
      throw e
    }
  }

  const handleDeleteCategory = async (catId: number) => {
    try {
      await deleteFAQCategoryFn({ data: { id: catId } })
      setFAQs((prev) => {
        const next = prev.filter((c) => c.categoryId !== catId)
        if (categoryId === catId) {
          setCategoryId(next[0]?.categoryId ?? null)
        }
        return next
      })
      toast.success("Category deleted successfully.")
    } catch (e: unknown) {
      console.error(e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to delete category: ${errorMessage}`)
    }
  }

  const handleAdd = () => {
    if (!categoryId) {
      toast.error("Please select or create a category first.")
      setIsAddCategoryOpen(true)
      return
    }

    if (editingId) {
      handleCancel(editingId)
    }

    const newId = Math.max(0, ...faqs.flatMap((faq) => faq.faqs.map((item) => item.faqId))) + 1
    const newItem: FAQItem = {
      faqId: newId,
      titleIt: "",
      titleEn: "",
      descriptionIt: "",
      descriptionEn: "",
    }

    setFAQs((prev) =>
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
    if (editingId && editingId !== item.faqId) {
      handleCancel(editingId)
    }
    setEditingId(item.faqId)
    setEditQuestionIt(item.titleIt)
    setEditQuestionEn(item.titleEn ?? "")
    setEditAnswerIt(item.descriptionIt)
    setEditAnswerEn(item.descriptionEn ?? "")
    setOpenItems((prev) => (prev.includes(item.faqId) ? prev : [...prev, item.faqId]))
  }

  const handleSave = async (id: number) => {
    if (!categoryId) return
    const qIt = editQuestionIt.trim()
    const qEn = editQuestionEn.trim()
    const aIt = editAnswerIt.trim()
    const aEn = editAnswerEn.trim()

    if (!qIt) return toast.error("Question (Italian) is required.")
    if (!aIt) return toast.error("Answer (Italian) is required.")
    if (!qEn) return toast.error("Question (English) is required.")
    if (!aEn) return toast.error("Answer (English) is required.")

    const isNew = unsavedIds.includes(id)
    const savePromise = isNew
      ? addFAQFn({ data: { titleIt: qIt, titleEn: qEn, descriptionIt: aIt, descriptionEn: aEn, categoryId } })
      : editFAQFn({ data: { id, titleIt: qIt, titleEn: qEn, descriptionIt: aIt, descriptionEn: aEn, categoryId } })

    try {
      const res = await savePromise
      const savedId = isNew ? res.id : id

      setFAQs((prev) =>
        prev.map((faq) => {
          if (faq.categoryId === categoryId) {
            return {
              ...faq,
              faqs: faq.faqs.map((item) => {
                if (item.faqId === id) {
                  return {
                    ...item,
                    faqId: savedId,
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
      if (isNew) {
        setOpenItems((prev) => prev.map((item) => (item === id ? savedId : item)))
      }
      setEditingId(null)
      setEditQuestionIt("")
      setEditQuestionEn("")
      setEditAnswerIt("")
      setEditAnswerEn("")
      toast.success("FAQ saved successfully.")
    } catch (e: unknown) {
      console.error(e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      toast.error(`Failed to save FAQ: ${errorMessage}`)
    }
  }

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation()

    const isNew = unsavedIds.includes(id)
    const deletePromise = isNew ? Promise.resolve() : deleteFAQFn({ data: { id } })

    deletePromise
      .then(() => {
        setFAQs((prev) =>
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
        toast.success("FAQ deleted successfully.")
      })
      .catch((e: string) => {
        console.error(e)
        toast.error(`Failed to delete FAQ: ${e}`)
      })
  }

  const handleCancel = (id: number) => {
    if (unsavedIds.includes(id)) {
      setFAQs((prev) =>
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
    }
    setEditingId(null)
    setEditQuestionIt("")
    setEditQuestionEn("")
    setEditAnswerIt("")
    setEditAnswerEn("")
  }

  const activeCategory = faqs.find((c) => c.categoryId === categoryId)
  const currentCategoryFAQs = activeCategory?.faqs ?? []

  return (
    <div className="animate-appear space-y-6">
      <FAQPageHeader
        onOpenAddCategory={() => setIsAddCategoryOpen(true)}
        onAddFAQ={handleAdd}
        hasCategory={!!categoryId}
      />

      <CategorySwitcher
        categories={faqs}
        activeCategoryId={categoryId || null}
        onSelectCategory={(id: React.SetStateAction<number | null>) => {
          if (editingId) {
            handleCancel(editingId)
          }
          setCategoryId(id)
        }}
        onDeleteCategory={handleDeleteCategory}
        onEditCategory={(cat) => {
          setEditingCategory(cat)
          setIsEditCategoryOpen(true)
        }}
      />

      <FAQAccordionList
        items={currentCategoryFAQs}
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
          initialIcon={editingCategory.icon}
          onAddCategory={async (titleIt, titleEn, icon) => {
            await handleUpdateCategory(editingCategory.categoryId, titleIt, titleEn, icon)
          }}
        />
      )}
    </div>
  )
}
