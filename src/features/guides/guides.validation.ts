import { z } from "zod"

export function parseGuideForm(data: FormData) {
  const version = data.get("version")
  const date = data.get("date")
  const file = data.get("file")

  if (typeof version !== "string" || !version.trim() || version.trim().length > 100) throw new Error("INVALID_VERSION")
  if (typeof date !== "string" || !z.iso.datetime().safeParse(date).success) throw new Error("INVALID_DATE")
  if (!(file instanceof File) || file.type !== "application/pdf") throw new Error("INVALID_FILE_TYPE")
  if (file.size > 2 * 1024 * 1024) throw new Error("FILE_TOO_LARGE")
  return { version: version.trim(), date, file }
}
