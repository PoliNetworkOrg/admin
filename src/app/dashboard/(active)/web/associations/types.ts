import type { LucideIcon } from "lucide-react"
import type { ASSOCIATION_LINK } from "./constants"

export type AssociationLink = (typeof ASSOCIATION_LINK)[keyof typeof ASSOCIATION_LINK]
export type AssociationLinks = Record<AssociationLink, string | null>

export type LinkField = {
  key: AssociationLink
  label: string
  icon: LucideIcon
}

export type Association = {
  id: number
  name: string
  descriptionIt: string
  descriptionEn: string
  logo: string | null
  links: AssociationLinks
}

export type AssociationSaveValues = Association & {
  logoFile: File | null
}
