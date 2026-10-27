import { amountInWords, receiptFileName } from "./people-fees"
import type { Receipt } from "./people.contract"

/**
 * Agent mode's files: the receipt PDF the backend generates, a sample transfer receipt and the ZIP of receipts to
 * sign. The backend owns the real ones; these follow the same template (docs/people/contract.md, "Receipt PDF") so the
 * downloads work without it. Plain PDF 1.4 with the standard Helvetica fonts, and a stored (uncompressed) ZIP.
 */

/** The association's details printed on receipts; placeholders until the backend has the real ones. */
export const ASSOCIATION = {
  name: "PoliNetwork",
  legalForm: "[Forma giuridica dell'associazione]",
  address: "[Indirizzo della sede legale], Milano",
  taxCode: "[codice fiscale]",
} as const

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
]

/** "14 ottobre 2026" for `2026-10-14`. */
export function italianDate(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`
}

/** "€ 10,00", as Italian documents write amounts. */
function italianAmount(cents: number) {
  return `€ ${Math.floor(cents / 100).toLocaleString("it-IT")},${String(cents % 100).padStart(2, "0")}`
}

// WinAnsi bytes for the few characters outside Latin-1 that Italian text uses.
const WIN_ANSI = new Map([
  ["€", 0x80],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["–", 0x96],
  ["—", 0x97],
])

/** A PDF string literal in WinAnsi encoding. */
function pdfText(text: string) {
  let out = "("
  for (const char of text) {
    const code = WIN_ANSI.get(char) ?? char.codePointAt(0) ?? 63
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`
    else if (code < 128) out += char
    else if (code < 256) out += `\\${code.toString(8).padStart(3, "0")}`
    else out += "?"
  }
  return `${out})`
}

type Op =
  | {
      kind: "text"
      x: number
      y: number
      size: number
      text: string
      bold?: boolean
      grey?: boolean
      white?: boolean
      mono?: boolean
    }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; width?: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: boolean }

/** One A4 page (595 × 842 pt) drawn from text, lines and rectangles. */
function pdfDocument(ops: Op[], title: string) {
  let stream = ""
  for (const op of ops) {
    if (op.kind === "text") {
      const font = op.mono ? "/F3" : op.bold ? "/F2" : "/F1"
      const colour = op.white ? "1 1 1 rg" : op.grey ? "0.35 0.38 0.42 rg" : "0.07 0.11 0.15 rg"
      stream += `BT ${colour} ${font} ${op.size} Tf ${op.x} ${op.y} Td ${pdfText(op.text)} Tj ET\n`
    } else if (op.kind === "line") {
      stream += `0.8 0.84 0.86 RG ${op.width ?? 0.75} w ${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S\n`
    } else {
      stream += op.fill
        ? `0.07 0.34 0.68 rg ${op.x} ${op.y} ${op.w} ${op.h} re f\n`
        : `0.8 0.84 0.86 RG 0.75 w ${op.x} ${op.y} ${op.w} ${op.h} re S\n`
    }
  }
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    `<< /Title ${pdfText(title)} /Producer (PoliNetwork Admin, agent mode) >>`,
  ]
  // Every character above is one byte (latin1), so string lengths are byte offsets.
  let out = "%PDF-1.4\n%âãÏÓ\n"
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(out.length)
    out += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}

/** Rough Helvetica width, enough to right-align short labels. */
function widthOf(text: string, size: number, mono = false) {
  return text.length * size * (mono ? 0.6 : 0.52)
}

/**
 * The receipt as the backend generates it, ready for the President's signature: association, number and date, the
 * member, the amount in figures and words, the reason, how and when it was paid, and the space for "Il Presidente".
 */
export function receiptPdf(receipt: Receipt, officers: { president: string; vicePresident: string }) {
  const left = 54
  const right = 541
  const ops: Op[] = []
  const text = (
    x: number,
    y: number,
    size: number,
    value: string,
    style: Partial<Extract<Op, { kind: "text" }>> = {}
  ) => ops.push({ kind: "text", x, y, size, text: value, ...style })
  const row = (y: number, label: string, value: string, mono = false) => {
    text(left, y, 11, label, { grey: true })
    text(left + 140, y, 11, value, { mono })
  }

  ops.push({ kind: "rect", x: left, y: 752, w: 34, h: 34, fill: true })
  text(left + 8, 765, 11, "PN", { bold: true, white: true })
  text(left + 46, 776, 13, ASSOCIATION.name, { bold: true })
  text(left + 46, 762, 9, ASSOCIATION.legalForm, { grey: true })
  text(left + 46, 750, 9, ASSOCIATION.address, { grey: true })
  text(left + 46, 738, 9, `C.F. ${ASSOCIATION.taxCode}`, { grey: true })
  text(right - widthOf("Ricevuta n.", 9), 776, 9, "Ricevuta n.", { grey: true })
  text(right - widthOf(receipt.number, 18, true), 756, 18, receipt.number, { mono: true })
  const place = `Milano, ${italianDate(receipt.issuedOn)}`
  text(right - widthOf(place, 9), 740, 9, place, { grey: true })
  ops.push({ kind: "line", x1: left, y1: 722, x2: right, y2: 722 })

  text(left, 690, 17, "Ricevuta di pagamento della quota associativa", { bold: true })

  text(left, 656, 9, "Ricevuto da", { bold: true, grey: true })
  row(636, "Nome e cognome", receipt.person.name)
  row(618, "Codice fiscale", "[codice fiscale del socio]", true)
  row(600, "Numero socio", receipt.memberNumber, true)

  ops.push({ kind: "rect", x: left, y: 530, w: right - left, h: 50 })
  text(left + 16, 560, 9, "La somma di", { grey: true })
  text(left + 16, 543, 11, `${amountInWords(receipt.amountCents)} euro`)
  const amount = italianAmount(receipt.amountCents)
  text(right - 16 - widthOf(amount, 20), 547, 20, amount, { bold: true })

  text(left, 500, 9, "A titolo di", { bold: true, grey: true })
  row(480, "Causale", `Quota associativa per l'anno sociale ${receipt.year}`)
  row(462, "Metodo di pagamento", receipt.method === "transfer" ? "Bonifico bancario" : "Contanti")
  row(
    444,
    receipt.method === "transfer" ? "Data del bonifico" : "Data del pagamento",
    italianDate(receipt.transferDate ?? receipt.paidOn)
  )
  text(left, 414, 9, "[Nota fiscale, se prevista: regime della quota ed eventuale imposta di bollo.]", { grey: true })

  const signer = receipt.signer === "president" ? "Il Presidente" : "Il Vicepresidente"
  const signerName = receipt.signer === "president" ? officers.president : officers.vicePresident
  text(right - 100 - widthOf(signer, 11) / 2, 220, 11, signer)
  ops.push({ kind: "line", x1: right - 200, y1: 160, x2: right, y2: 160 })
  text(right - 100 - widthOf(signerName, 9) / 2, 146, 9, signerName, { grey: true })

  ops.push({ kind: "line", x1: left, y1: 76, x2: right, y2: 76 })
  text(left, 60, 8, `${ASSOCIATION.name} · ${ASSOCIATION.address} · C.F. ${ASSOCIATION.taxCode}`, { grey: true })
  const footer = `Ricevuta ${receipt.number} · pagina 1 di 1`
  text(right - widthOf(footer, 8, true), 60, 8, footer, { mono: true, grey: true })
  return pdfDocument(ops, `Ricevuta ${receipt.number}`)
}

/** A stand-in for a member's uploaded bank receipt, for the review preview in agent mode. */
export function sampleTransferPdf(input: { name: string; memberNumber: string; date: string; amountCents: number }) {
  const left = 72
  const ops: Op[] = []
  const line = (y: number, label: string, value: string) => {
    ops.push({ kind: "text", x: left, y, size: 11, text: label, grey: true })
    ops.push({ kind: "text", x: left + 150, y, size: 11, text: value, mono: true })
  }
  ops.push({ kind: "text", x: left, y: 760, size: 16, text: "Bonifico SEPA eseguito", bold: true })
  ops.push({ kind: "text", x: left, y: 740, size: 9, text: "Sample file in agent mode", grey: true })
  ops.push({ kind: "line", x1: left, y1: 726, x2: 523, y2: 726 })
  line(700, "Ordinante", input.name)
  line(680, "Beneficiario", "PoliNetwork")
  line(660, "IBAN beneficiario", "[IBAN]")
  line(640, "Importo", `${(input.amountCents / 100).toFixed(2).replace(".", ",")} EUR`)
  line(620, "Data esecuzione", input.date.split("-").reverse().join("/"))
  line(600, "Causale", `Quota 2026/27 ${input.memberNumber} ${input.name}`)
  line(580, "TRN", "[TRN]")
  return pdfDocument(ops, "Bonifico")
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 1 January 1980, the earliest date ZIP can hold: the files have no meaningful timestamp. */
const DOS_DATE = (1 << 5) | 1

/** A ZIP of the given files, stored without compression (PDFs barely compress). */
export function zipFiles(files: { name: string; bytes: Uint8Array }[]) {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8")
    const crc = crc32(file.bytes)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(file.bytes.length, 18)
    local.writeUInt32LE(file.bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    parts.push(local, name, Buffer.from(file.bytes))
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(DOS_DATE, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(file.bytes.length, 20)
    entry.writeUInt32LE(file.bytes.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)
    offset += local.length + name.length + file.bytes.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, directory, end])
}

/** The file name of a receipt download: the signed copy once there is one. */
export function downloadName(receipt: Receipt) {
  return receiptFileName(receipt.number, receipt.status !== "toSign")
}

/**
 * Whether a file carries a digital signature, as far as agent mode can tell: a CAdES `.p7m` envelope, a PDF with a
 * signature dictionary (`/ByteRange`, what the CIE app's PAdES signature adds), or a name that says it was signed.
 * The backend verifies the signature and its certificate for real.
 */
export function looksSigned(fileName: string, bytes: Uint8Array) {
  if (/\.p7m$/i.test(fileName) || /(signed|firmat[ao])/i.test(fileName)) return true
  return Buffer.from(bytes).includes("/ByteRange")
}
