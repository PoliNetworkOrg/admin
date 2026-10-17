import type { ApiOutput } from "@/lib/api/types"

export type Association = ApiOutput["web"]["associations"]["getAllAssociations"][number]
export type AssociationLinks = Association["links"]
export type AssociationLink = keyof AssociationLinks

/** The inline edit's values; `logo` is the shown image (saved URL or a chosen file's preview). */
export type AssociationForm = Pick<Association, "name" | "descriptionIt" | "descriptionEn" | "logo"> & {
  logoFile: File | null
}
