import { z } from "zod"

export function parseGuideForm(data: FormData) {
  const version = z.string().trim().min(1).max(100).safeParse(data.get("version"))
  const date = z.iso.datetime().safeParse(data.get("date"))
  const file = data.get("file")

  if (!version.success) throw new Error("INVALID_VERSION")
  if (!date.success) throw new Error("INVALID_DATE")
  if (!(file instanceof File) || file.type !== "application/pdf") throw new Error("INVALID_FILE_TYPE")
  if (file.size > 2 * 1024 * 1024) throw new Error("FILE_TOO_LARGE")
  return { version: version.data, date: date.data, file }
}
