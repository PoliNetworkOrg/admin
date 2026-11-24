// Formatting shared by the portal pages, kept out of the components so the Node tests can import it.
const creditNumber = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 })
/** Credits are stored in hundredths: 250 → "2,5 crediti", 100 → "1 credito". */
export function formatCredits(hundredths: number) {
  return `${creditNumber.format(hundredths / 100)} ${Math.abs(hundredths) === 100 ? "credito" : "crediti"}`
}
/** "2,5" or "2.5" → 250; null when it is not a number. */
export function parseCredits(text: string) {
  const value = Number(text.trim().replace(",", "."))
  return text.trim() && Number.isFinite(value) ? Math.round(value * 100) : null
}
/** 250 → "2,5", for editable fields. */
export const creditInput = (hundredths: number) => String(hundredths / 100).replace(".", ",")
