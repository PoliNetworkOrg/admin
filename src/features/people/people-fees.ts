/**
 * Membership fees and receipts: pure helpers shared by the pages, the agent-mode API and the tests. No `@/` imports,
 * so `node --test` loads this file as it is.
 */

/** "€10.00": amounts travel as integer cents. */
export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100)
}

/** "10", "10.5", "10,50" or "€ 10.00" as cents; `null` for anything else, zero or negative. */
export function parseEuros(text: string): number | null {
  const match = /^\s*€?\s*(\d{1,5})(?:[.,](\d{1,2}))?\s*$/.exec(text)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"))
  return cents > 0 ? cents : null
}

/** "10.00" for an amount input. */
export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2)
}

/** Receipt numbers are the fee year's first calendar year and a three-digit sequence: "2026/042". */
export const RECEIPT_NUMBER_PATTERN = /^\d{4}\/\d{3,}$/

/** The receipt number written in a file name ("Ricevuta_2026-042_firmata.pdf" → "2026/042"), or `null`. */
export function receiptNumberFromFileName(fileName: string): string | null {
  const match = /(?:^|\D)(20\d{2})[\s_./-]?(\d{3})(?!\d)/.exec(fileName)
  return match ? `${match[1]}/${match[2]}` : null
}

/** The file name a receipt is downloaded under, which `receiptNumberFromFileName` reads back. */
export function receiptFileName(number: string, signed = false) {
  return `Ricevuta_${number.replace("/", "-")}${signed ? "_firmata" : ""}.pdf`
}

/** The first calendar year of a fee year: "2026/27" → "2026". */
export function receiptYearPrefix(feeYear: string) {
  return feeYear.slice(0, 4)
}

/** The next receipt number of a fee year: numbers are never reused, voided ones included. */
export function nextReceiptNumber(feeYear: string, numbers: readonly string[]) {
  const prefix = receiptYearPrefix(feeYear)
  const highest = numbers
    .filter((number) => number.startsWith(`${prefix}/`))
    .reduce((max, number) => Math.max(max, Number(number.slice(5))), 0)
  return `${prefix}/${String(highest + 1).padStart(3, "0")}`
}

const UNITS = [
  "zero",
  "uno",
  "due",
  "tre",
  "quattro",
  "cinque",
  "sei",
  "sette",
  "otto",
  "nove",
  "dieci",
  "undici",
  "dodici",
  "tredici",
  "quattordici",
  "quindici",
  "sedici",
  "diciassette",
  "diciotto",
  "diciannove",
]
const TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"]

function belowHundred(value: number): string {
  if (value < 20) return UNITS[value] ?? ""
  const tens = TENS[Math.floor(value / 10)] ?? ""
  const unit = value % 10
  if (unit === 0) return tens
  // "ventuno", "trentotto": the tens drop their vowel before uno and otto.
  const stem = unit === 1 || unit === 8 ? tens.slice(0, -1) : tens
  return stem + (unit === 3 ? "tré" : (UNITS[unit] ?? ""))
}

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  const head = hundreds === 0 ? "" : hundreds === 1 ? "cento" : `${UNITS[hundreds] ?? ""}cento`
  if (rest === 0) return head || "zero"
  // "centotto", "centottanta": cento keeps its o only before a consonant.
  const tail = belowHundred(rest)
  return head && tail.startsWith("o") ? head.slice(0, -1) + tail : head + tail
}

/** The amount in Italian words, as receipts write it: 1000 → "dieci/00", 2550 → "venticinque/50". */
export function amountInWords(cents: number) {
  const euros = Math.floor(cents / 100)
  const rest = String(cents % 100).padStart(2, "0")
  if (euros >= 1_000_000) return `${euros}/${rest}`
  const thousands = Math.floor(euros / 1000)
  const below = euros % 1000
  const head = thousands === 0 ? "" : thousands === 1 ? "mille" : `${belowThousand(thousands)}mila`
  const words = thousands > 0 && below === 0 ? head : head + belowThousand(below)
  return `${words}/${rest}`
}

/** What happens to one signed file in Upload signed receipts. */
export type SignedFileOutcome = "ready" | "noReceipt" | "duplicate" | "notToSign" | "otherSigner" | "notSigned"

/**
 * A signed file is sent only when it points at a receipt waiting for a signature, no other file points there, the
 * receipt is the viewer's to sign (the Vice-president signs the President's own) and the file carries a signature.
 */
export function signedFileOutcome(input: {
  signed: boolean
  receipt: { status: string; signer: string } | null
  viewerSigner: string | null
  duplicate: boolean
}): SignedFileOutcome {
  if (!input.receipt) return "noReceipt"
  if (input.duplicate) return "duplicate"
  if (input.receipt.status !== "toSign") return "notToSign"
  if (input.receipt.signer !== input.viewerSigner) return "otherSigner"
  if (!input.signed) return "notSigned"
  return "ready"
}
