const dateOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" } as const
const dateFormat = new Intl.DateTimeFormat("en-GB", dateOptions)
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  ...dateOptions,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const numberFormat = new Intl.NumberFormat("en-GB")
const pluralRules = new Intl.PluralRules("en-GB")

const IRREGULAR_PLURALS = new Map([
  ["category", "categories"],
  ["sub-category", "sub-categories"],
  ["FAQ", "FAQs"],
  ["edition", "editions"],
  ["membership", "memberships"],
  ["person", "people"],
  ["reply", "replies"],
  ["entry", "entries"],
])

export function formatDate(date: Date): string {
  return dateFormat.format(date)
}

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date)
}

export function formatRange(start: Date, end: Date): string {
  return `${formatDateTime(start)} → ${formatDateTime(end)}`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

function pluralNoun(count: number, noun: string): string {
  if (pluralRules.select(count) === "one") return noun
  const irregular = IRREGULAR_PLURALS.get(noun)
  if (irregular) return irregular
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`
  return `${noun}s`
}

/** "1 group", "1,318 groups". `noun` is the singular form. */
export function pluralize(count: number, noun: string): string {
  return `${formatNumber(count)} ${pluralNoun(count, noun)}`
}

export function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).host.replace(/^www\./, "") : url
}

const LICENSE_ACRONYMS = new Set(["BI", "AAD", "EMS", "SKU"])

/** License SKUs as names: "OFFICE_365" → "Office 365", "POWER_BI_FREE" → "Power BI Free". */
export function formatLicense(sku: string): string {
  return sku
    .split("_")
    .filter(Boolean)
    .map((word) => {
      const upper = word.toLocaleUpperCase()
      if (LICENSE_ACRONYMS.has(upper) || /^\d+$/.test(word)) return upper
      return upper.charAt(0) + upper.slice(1).toLocaleLowerCase()
    })
    .join(" ")
}
