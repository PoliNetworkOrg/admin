import {
  createAssociation,
  deleteAssociation,
  editAssociation,
  editAssociationLinks,
  getAssociations,
} from "@/features/associations/associations.functions"
import {
  associationFormFields,
  associationIdInput,
  associationLinksInput,
  editAssociationFormFields,
} from "@/features/associations/associations.validation"
import {
  addDocumentVersion,
  createDocument,
  createDocumentCategory,
  deleteDocument,
  deleteDocumentCategory,
  deleteDocumentVersion,
  getDocumentsCatalog,
  reorderDocumentCategories,
  reorderDocuments,
  updateDocument,
  updateDocumentCategory,
} from "@/features/documents/documents.functions"
import {
  documentCategoryInput,
  documentIdInput,
  documentInput,
  documentVersionFormFields,
  reorderDocumentCategoriesInput,
  reorderDocumentsInput,
  updateDocumentCategoryInput,
  updateDocumentInput,
} from "@/features/documents/documents.validation"
import {
  addFAQ,
  addFAQCategory,
  deleteFAQ,
  deleteFAQCategory,
  editFAQ,
  editFAQCategory,
  listFAQs,
} from "@/features/faqs/faqs.functions"
import {
  addFAQCategoryInput,
  addFAQInput,
  deleteFAQCategoryInput,
  deleteFAQInput,
  editFAQCategoryInput,
  editFAQInput,
} from "@/features/faqs/faqs.validation"
import {
  getFreshmanContent,
  moveFreshmanCard,
  selectFreshmanFaq,
  updateFreshmanCard,
  updateFreshmanTelegramCard,
} from "@/features/freshman/freshman.functions"
import {
  moveFreshmanCardInput,
  selectFreshmanFaqInput,
  updateFreshmanCardInput,
  updateFreshmanTelegramCardInput,
} from "@/features/freshman/freshman.validation"
import { createGuide, deleteGuide, getGuides } from "@/features/guides/guides.functions"
import { guideFormFields, guideIdInput } from "@/features/guides/guides.validation"
import {
  createProject,
  deleteProject,
  editProject,
  getProjects,
  reorderProjects,
} from "@/features/projects/projects.functions"
import {
  editProjectFormFields,
  projectFormFields,
  projectIdInput,
  reorderProjectsInput,
} from "@/features/projects/projects.validation"

import { destructive, read, type UploadFile, write } from "../operation"

const PROJECT_LOGO: UploadFile = {
  field: "logoFile",
  required: false,
  description: "The logo: SVG, PNG or JPEG, up to 1 MB. Omit it to keep the current logo.",
}

const ASSOCIATION_LOGO: UploadFile = {
  field: "logo",
  required: false,
  description: "The logo: JPEG, PNG or SVG, up to 1 MB. Omit it to keep the current logo.",
}

export const websiteOperations = [
  read("website.projects.list", getProjects, {
    guard: "adminMiddleware",
    description: "List the projects shown on the PoliNetwork website, in website order, with their category.",
  }),
  write("website.projects.create", createProject, {
    guard: "webContentWriteMiddleware",
    input: projectFormFields,
    files: [PROJECT_LOGO],
    description: "Add a project to the public PoliNetwork website.",
  }),
  write("website.projects.edit", editProject, {
    guard: "webContentWriteMiddleware",
    input: editProjectFormFields,
    files: [PROJECT_LOGO],
    description:
      "Replace one project's fields on the public website (id from website.projects.list); an omitted link is removed. Changing category moves it.",
  }),
  write("website.projects.reorder", reorderProjects, {
    guard: "webContentWriteMiddleware",
    input: reorderProjectsInput,
    description:
      "Set the public website's order of one category's projects: every project id of that category (from website.projects.list), in order.",
  }),
  destructive("website.projects.delete", deleteProject, {
    guard: "webContentWriteMiddleware",
    input: projectIdInput,
    description: "Delete one project from the public website (id from website.projects.list).",
  }),

  read("website.associations.list", getAssociations, {
    guard: "adminMiddleware",
    description: "List the student associations shown on the PoliNetwork website, with their logos and links.",
  }),
  write("website.associations.create", createAssociation, {
    guard: "webContentWriteMiddleware",
    input: associationFormFields,
    files: [ASSOCIATION_LOGO],
    description:
      "Add a student association to the public website, without links (then website.associations.editLinks).",
  }),
  write("website.associations.edit", editAssociation, {
    guard: "webContentWriteMiddleware",
    input: editAssociationFormFields,
    files: [ASSOCIATION_LOGO],
    description:
      "Replace one association's name and descriptions on the public website (id from website.associations.list); the logo only if sent.",
  }),
  write("website.associations.editLinks", editAssociationLinks, {
    guard: "webContentWriteMiddleware",
    input: associationLinksInput,
    description:
      "Replace all of one association's contact links on the public website; null removes a link. Id from website.associations.list.",
  }),
  destructive("website.associations.delete", deleteAssociation, {
    guard: "webContentWriteMiddleware",
    input: associationIdInput,
    description: "Delete one association from the public website (id from website.associations.list).",
  }),

  read("website.faqs.list", listFAQs, {
    guard: "adminMiddleware",
    description: "List the website's FAQ categories, each with its FAQs (categoryId, faqId), in Italian and English.",
  }),
  write("website.faqs.create", addFAQ, {
    guard: "webContentWriteMiddleware",
    input: addFAQInput,
    description: "Add an FAQ to a category (categoryId from website.faqs.list) on the public website.",
  }),
  write("website.faqs.edit", editFAQ, {
    guard: "webContentWriteMiddleware",
    input: editFAQInput,
    description:
      "Replace one FAQ (id = faqId from website.faqs.list) on the public website; a different categoryId moves it.",
  }),
  destructive("website.faqs.delete", deleteFAQ, {
    guard: "webContentWriteMiddleware",
    input: deleteFAQInput,
    description:
      "Delete one FAQ (id = faqId from website.faqs.list) from the public website; refused while it is on the freshman page.",
  }),
  write("website.faqs.createCategory", addFAQCategory, {
    guard: "webContentWriteMiddleware",
    input: addFAQCategoryInput,
    description:
      "Add an FAQ category to the public website; icon is an icon name such as help-circle (the default), book-open or calendar.",
  }),
  write("website.faqs.editCategory", editFAQCategory, {
    guard: "webContentWriteMiddleware",
    input: editFAQCategoryInput,
    description:
      "Replace one FAQ category's titles and icon (id = categoryId from website.faqs.list) on the public website; an omitted icon is removed.",
  }),
  destructive("website.faqs.deleteCategory", deleteFAQCategory, {
    guard: "webContentWriteMiddleware",
    input: deleteFAQCategoryInput,
    description:
      "Delete one FAQ category and its FAQs (id = categoryId from website.faqs.list) from the public website; refused while one is on the freshman page.",
  }),

  read("website.freshman.get", getFreshmanContent, {
    guard: "adminMiddleware",
    description:
      "Read the website's freshman page: its fixed card slots (featured, guides, materials, tools, telegram) and its five FAQs.",
  }),
  write("website.freshman.updateCard", updateFreshmanCard, {
    guard: "webContentWriteMiddleware",
    input: updateFreshmanCardInput,
    description:
      "Replace one resource card of the public freshman page (slot id from website.freshman.get, not a telegram-* slot); href is a site path or an HTTP(S) URL.",
  }),
  write("website.freshman.updateTelegramCard", updateFreshmanTelegramCard, {
    guard: "webContentWriteMiddleware",
    input: updateFreshmanTelegramCardInput,
    description:
      "Link one Telegram slot of the public freshman page (telegram-1…8) to a Telegram group (telegramGroupId from telegram.groups.list; it needs an invite link): the website shows the group's current link. title is a display name, empty for the group's own.",
  }),
  write("website.freshman.moveCard", moveFreshmanCard, {
    guard: "webContentWriteMiddleware",
    input: moveFreshmanCardInput,
    description:
      "Swap one card of the public freshman page with its previous (-1) or next (1) slot; only within its section.",
  }),
  write("website.freshman.selectFaq", selectFreshmanFaq, {
    guard: "webContentWriteMiddleware",
    input: selectFreshmanFaqInput,
    description:
      "Show an FAQ (faqId from website.faqs.list) at one of the freshman page's five FAQ positions (0–4) on the public website.",
  }),

  read("website.guides.list", getGuides, {
    guard: "adminMiddleware",
    description: "List the freshman guide PDFs (Guida matricola) by version; the website offers the newest.",
  }),
  write("website.guides.create", createGuide, {
    guard: "webContentWriteMiddleware",
    input: guideFormFields,
    files: [{ field: "file", required: true, description: "The guide: a PDF up to 2 MB." }],
    description:
      "Upload a freshman guide PDF, published on the public website; version must be new, date an ISO date-time.",
  }),
  destructive("website.guides.delete", deleteGuide, {
    guard: "webContentWriteMiddleware",
    input: guideIdInput,
    description: "Delete one freshman guide version (id from website.guides.list) from the public website.",
  }),

  read("website.documents.list", getDocumentsCatalog, {
    guard: "adminMiddleware",
    description:
      "List the website's document categories, each with its documents and their PDF versions (newest first), empty ones included.",
  }),
  write("website.documents.createCategory", createDocumentCategory, {
    guard: "webContentWriteMiddleware",
    input: documentCategoryInput,
    description: "Add a document category to the public website; slug is lowercase kebab-case and unique.",
  }),
  write("website.documents.editCategory", updateDocumentCategory, {
    guard: "webContentWriteMiddleware",
    input: updateDocumentCategoryInput,
    description:
      "Replace one document category's slug, title and description (id from website.documents.list) on the public website.",
  }),
  write("website.documents.reorderCategories", reorderDocumentCategories, {
    guard: "webContentWriteMiddleware",
    input: reorderDocumentCategoriesInput,
    description: "Set the website order of the document categories: every category id, in the new order.",
  }),
  destructive("website.documents.deleteCategory", deleteDocumentCategory, {
    guard: "webContentWriteMiddleware",
    input: documentIdInput,
    description: "Delete one empty document category (id from website.documents.list) from the public website.",
  }),
  write("website.documents.create", createDocument, {
    guard: "webContentWriteMiddleware",
    input: documentInput,
    description:
      "Add a document to a category (categoryId from website.documents.list) on the public website; then upload a PDF with website.documents.addVersion.",
  }),
  write("website.documents.edit", updateDocument, {
    guard: "webContentWriteMiddleware",
    input: updateDocumentInput,
    description:
      "Replace one document's category, slug, title and description (id from website.documents.list) on the public website.",
  }),
  write("website.documents.reorder", reorderDocuments, {
    guard: "webContentWriteMiddleware",
    input: reorderDocumentsInput,
    description:
      "Set the website order of one category's documents: every document id of that category, in the new order.",
  }),
  destructive("website.documents.delete", deleteDocument, {
    guard: "webContentWriteMiddleware",
    input: documentIdInput,
    description: "Delete one document and all its versions (id from website.documents.list) from the public website.",
  }),
  write("website.documents.addVersion", addDocumentVersion, {
    guard: "webContentWriteMiddleware",
    input: documentVersionFormFields,
    files: [{ field: "file", required: true, description: "The version: a non-empty PDF up to 10 MB." }],
    description:
      "Upload a new PDF version of a document (documentId from website.documents.list), published on the website; date is YYYY-MM-DD.",
  }),
  destructive("website.documents.deleteVersion", deleteDocumentVersion, {
    guard: "webContentWriteMiddleware",
    input: documentIdInput,
    description: "Delete one PDF version (its id from website.documents.list) of a document from the public website.",
  }),
]
