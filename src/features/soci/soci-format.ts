import type { StatusTone } from "@/components/primitives"

import type { END_REASONS, Residence, SocioRow } from "./soci.contract"

type Tone = { label: string; tone: StatusTone }

/** "0344": member numbers as the payment reference writes them. */
export function formatMemberNumber(number: number) {
  return String(number).padStart(4, "0")
}

/** The legal name. The alias, when there is one, is its secondary line. */
export function socioName(socio: Pick<SocioRow, "firstName" | "lastName">) {
  return `${socio.firstName} ${socio.lastName}`
}

export const SOCIO_STATUS = {
  active: { label: "Active", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
} satisfies Record<string, Tone>

export function socioStatus(socio: Pick<SocioRow, "endedOn">) {
  return socio.endedOn ? SOCIO_STATUS.ended : SOCIO_STATUS.active
}

export const END_REASON = {
  lapsed: "Lapsed",
  resigned: "Resigned",
  expelled: "Expelled",
  deceased: "Deceased",
  other: "Other",
} satisfies Record<(typeof END_REASONS)[number], string>

export const ACCOUNT_STATE = {
  active: { label: "Active", tone: "success" },
  pending_deletion: { label: "Pending deletion", tone: "warning" },
  deleted: { label: "Deleted", tone: "neutral" },
} satisfies Record<SocioRow["accountState"], Tone>

export const MISMATCH = {
  not_in_soci: "Active, but not in the Soci group",
  still_in_soci: "Ended, but still in the Soci group",
} satisfies Record<NonNullable<SocioRow["mismatch"]>, string>

/** "Via Bonardi 9, 20133 Milano (MI), IT", or null when nothing is recorded. */
export function formatResidence(residence: Residence) {
  const place = [residence.postalCode, residence.city].filter(Boolean).join(" ")
  const parts = [
    residence.street,
    place ? `${place}${residence.province ? ` (${residence.province})` : ""}` : null,
    residence.country,
  ]
  const text = parts.filter(Boolean).join(", ")
  return text === "" ? null : text
}

/** The bookkeeping fields still empty on a record registered from Microsoft 365. */
export function missingDetails(socio: {
  codiceFiscale: string | null
  birthDate: string | null
  birthPlace: string | null
  residence: Residence
}) {
  const missing: string[] = []
  if (!socio.codiceFiscale) missing.push("codice fiscale")
  if (!socio.birthDate || !socio.birthPlace) missing.push("birth data")
  if (!socio.residence.street || !socio.residence.city || !socio.residence.country) missing.push("residence")
  return missing
}
