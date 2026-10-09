import { z } from "zod"

const MAX_GUIDE_BYTES = 2 * 1024 * 1024

/** A PDF up to 2 MB: the rule the server enforces, checked in the dialog before uploading. */
export function isValidGuideFile(file: File) {
  return file.type === "application/pdf" && file.size <= MAX_GUIDE_BYTES
}

export function parseGuideForm(data: FormData) {
  const version = z.string().trim().min(1).max(100).safeParse(data.get("version"))
  const date = z.iso.datetime().safeParse(data.get("date"))
  const file = data.get("file")

  if (!version.success) throw new Error("INVALID_VERSION")
  if (!date.success) throw new Error("INVALID_DATE")
  if (!(file instanceof File) || file.type !== "application/pdf") throw new Error("INVALID_FILE_TYPE")
  if (file.size > MAX_GUIDE_BYTES) throw new Error("FILE_TOO_LARGE")
  return { version: version.data, date: date.data, file }
}
