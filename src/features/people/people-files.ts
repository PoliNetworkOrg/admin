import type { FilePayload } from "./people.contract"

/** A file the server sent as base64, as a Blob the browser can show or save. */
export function fileBlob(file: FilePayload) {
  const binary = atob(file.base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: file.contentType })
}

/** Saves the file under its own name. */
export function saveFile(file: FilePayload) {
  const url = URL.createObjectURL(fileBlob(file))
  const link = document.createElement("a")
  link.href = url
  link.download = file.fileName
  link.click()
  // Revoked later: some browsers start the download after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
