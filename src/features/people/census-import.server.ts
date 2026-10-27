/** Validate before forwarding; the backend must also cap decompression and parsed rows. */
export async function validateCensusImport(file: File) {
  if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error("Choose an .xlsx or .csv file.")
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose a file up to 10 MB.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    if (bytes.some((byte) => byte < 32 && ![9, 10, 13].includes(byte))) throw new Error("Choose a UTF-8 CSV file.")
    let quoted = false
    let rows = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '"') {
        if (quoted && text[i + 1] === '"') i++
        else quoted = !quoted
      } else if (text[i] === "\n" && !quoted) rows++
    }
    if (quoted) throw new Error("The CSV has an unfinished quoted field.")
    if (rows + (text.endsWith("\n") ? 0 : 1) > 5001) throw new Error("Import at most 5,000 responses.")
    return
  }
  // Inspect the central directory, not bytes that happen to resemble ZIP headers inside compressed data.
  const view = new DataView(bytes.buffer)
  const invalid = () => new Error("Choose a valid .xlsx workbook.")
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) throw invalid()
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0 || end < bytes.length - 65557) throw invalid()
  const entries = view.getUint16(end + 10, true)
  const size = view.getUint32(end + 12, true)
  let offset = view.getUint32(end + 16, true)
  if (
    entries > 1000 ||
    offset + size !== end ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== entries ||
    end + 22 + view.getUint16(end + 20, true) !== bytes.length
  )
    throw invalid()
  let expanded = 0
  const names = new Set<string>()
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw invalid()
    expanded += view.getUint32(offset + 24, true)
    if (expanded > 50 * 1024 * 1024) throw new Error("The expanded workbook exceeds 50 MB.")
    const nameLength = view.getUint16(offset + 28, true)
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    if (next > end) throw invalid()
    names.add(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)))
    offset = next
  }
  if (offset !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) throw invalid()
}
