import { crc32, deflateSync } from "node:zlib"

/**
 * Agent mode's sample transfer receipts, made in memory: a one-page PDF with the transfer's lines, and a PNG standing
 * in for a photo of a phone screen. Base64, as `soci.fees.file` returns files.
 */

/** A one-page A5 PDF with `lines` in Helvetica, its cross-reference offsets computed. */
export function samplePdf(lines: readonly string[]) {
  const text = lines
    .map((line, index) => `BT /F1 ${index === 0 ? 14 : 10} Tf 40 ${540 - index * 22} Td (${escape(line)}) Tj ET`)
    .join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ]
  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, "latin1").toString("base64")
}

const escape = (line: string) => line.replace(/[\\()]/g, (char) => `\\${char}`)

/** A 360×640 PNG: a phone screen whose lower half is cut off, as a socio might photograph it. */
export function samplePng() {
  const width = 360
  const height = 640
  const rows: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x++) {
      const bar = y > 60 && y < 600 && x > 32 && x < 328 && (y - 60) % 48 < 14
      const header = y < 48
      const cut = y > 420
      const [r, g, b] = cut ? [24, 24, 27] : header ? [37, 99, 235] : bar ? [212, 212, 216] : [250, 250, 250]
      row.set([r, g, b], 1 + x * 3)
    }
    rows.push(row)
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typed))
    return Buffer.concat([length, typed, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64")
}
