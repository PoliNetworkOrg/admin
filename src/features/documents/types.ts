import type { ApiOutput } from "@/lib/api/types"

export type DocumentCategory = ApiOutput["web"]["documents"]["getAdminCatalog"][number]
export type WebDocument = DocumentCategory["documents"][number]
/** Newest first: the first is the version the website links. */
export type DocumentVersion = WebDocument["versions"][number]
