import type { ApiOutput } from "@/lib/api/types"

export type Association = ApiOutput["web"]["associations"]["getAllAssociations"][number]
export type AssociationLinks = Association["links"]
export type AssociationLink = keyof AssociationLinks
