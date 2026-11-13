import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webContentWriteMiddleware } from "@/server/auth.middleware"

import {
  documentCategoryInput,
  documentIdInput,
  documentInput,
  parseDocumentVersionForm,
  reorderDocumentCategoriesInput,
  reorderDocumentsInput,
  updateDocumentCategoryInput,
  updateDocumentInput,
} from "./documents.validation"

/** Every category with its documents and their versions (newest first), including empty ones. */
export const getDocumentsCatalog = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.documents.getAdminCatalog.query())

export const createDocumentCategory = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(documentCategoryInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.createCategory.mutate(data)
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const updateDocumentCategory = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(updateDocumentCategoryInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.updateCategory.mutate(data)
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteDocumentCategory = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(documentIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.deleteCategory.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderDocumentCategories = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(reorderDocumentCategoriesInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.reorderCategories.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const createDocument = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(documentInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.createDocument.mutate({
      ...data,
      description: data.description || null,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(updateDocumentInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.updateDocument.mutate({
      ...data,
      description: data.description || null,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(documentIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.deleteDocument.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderDocuments = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(reorderDocumentsInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.reorderDocuments.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const addDocumentVersion = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(parseDocumentVersionForm)
  .handler(async ({ data, context }) => {
    const formData = new FormData()
    formData.set("documentId", String(data.documentId))
    formData.set("version", data.version)
    formData.set("date", data.date)
    formData.set("file", data.file)

    const result = await context.backend.web.documents.addVersion.mutate(formData)
    if ("error" in result) throw new Error(result.error)
    return { id: result.id, version: result.version, date: result.date, file: result.file }
  })

export const deleteDocumentVersion = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(documentIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.documents.deleteVersion.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
