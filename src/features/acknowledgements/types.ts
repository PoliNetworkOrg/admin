import type { ApiOutput } from "@/lib/api/types"

export type Acknowledgements = ApiOutput["web"]["acknowledgements"]["getAll"]
/** A role group of the website section, with its people in display order. */
export type AcknowledgementGroup = Acknowledgements["website"][number]
/** A credited person: a name and an optional detail (their role, or the project they worked on). */
export type Acknowledgement = Acknowledgements["projects"][number]
export type AcknowledgementIconName = AcknowledgementGroup["icon"]
/** Where a person is listed: a role group of the website section, or the flat projects list. */
export type AcknowledgementList = { section: "website"; groupId: number } | { section: "projects" }
