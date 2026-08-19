import type { ApiOutput } from "@/lib/api/types"

export type Association = ApiOutput["web"]["associations"]["getAllAssociations"][number]
export type AssociationLinks = Association["links"]
export type AssociationLink = keyof AssociationLinks

export type AssociationFormValues = Pick<Association, "name" | "descriptionIt" | "descriptionEn"> & {
  logo: string | null
  logoFile: File | null
}
