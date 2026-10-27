import { parseCreateAssociationForm, parseEditAssociationForm } from "../features/associations/associations.validation"
import { parseGuideForm } from "../features/guides/guides.validation"
import { validateCensusImport } from "../features/people/census-import.server"
import { campaignInputSchema, transferInputSchema } from "../features/people/people.contract"
import { parseProjectForm } from "../features/projects/projects.validation"
import { multipartInput } from "./catalog"

/** Files arrive as explicit bytes, never as paths that could let a model read the user's computer. */
export async function uploadForm(path: string, input: ReturnType<typeof multipartInput.parse>) {
  const form = new FormData()
  for (const [key, value] of Object.entries(input.fields)) form.set(key, value)
  let total = 0
  const files = input.files.map((entry) => {
    const bytes = Buffer.from(entry.base64, "base64")
    total += bytes.length
    if (!bytes.length || total > 50 * 1024 * 1024) throw new Error("Choose non-empty files, at most 50 MB total.")
    const file = new File([bytes], entry.name, { type: entry.type })
    form.append(entry.field, file)
    return file
  })
  const single = (field: string) => {
    const entry = form.get(field)
    if (files.length !== 1 || !(entry instanceof File)) throw new Error(`Choose one file in the ${field} field.`)
    return entry
  }
  if (path.startsWith("web.projects.")) {
    // The dashboard parser calls this logoFile; the backend multipart field is logo.
    const logo = form.get("logo")
    if (logo instanceof File) form.set("logoFile", logo)
    const parsed = parseProjectForm(form)
    if (path.endsWith("editProject") && !/^[1-9]\d*$/.test(input.fields.id ?? "")) throw new Error("INVALID_ID")
    if (files.length > 1) throw new Error("Choose at most one logo.")
    form.delete("logoFile")
    if (!parsed.logoFile) form.delete("logo")
  } else if (path === "web.associations.addAssociation") {
    parseCreateAssociationForm(form)
    if (files.length > 1) throw new Error("Choose at most one logo.")
  } else if (path === "web.associations.editAssociation") {
    parseEditAssociationForm(form)
    if (files.length > 1) throw new Error("Choose at most one logo.")
  } else if (path === "web.guides_matricole.addGuide") {
    single("file")
    parseGuideForm(form)
  } else if (path === "people.census.importPreview") {
    campaignInputSchema.parse({ campaignId: input.fields.campaignId })
    await validateCensusImport(single("file"))
  } else if (path === "people.me.uploadTransferReceipt") {
    const receipt = single("file")
    transferInputSchema.parse({
      transferDate: input.fields.transferDate,
      amountCents: Number(input.fields.amountCents),
    })
    if (!/\.(pdf|jpe?g|png)$/i.test(receipt.name) || receipt.size > 10 * 1024 * 1024) {
      throw new Error("Choose a PDF, JPG or PNG up to 10 MB.")
    }
  } else if (path === "people.receipts.previewSigned") {
    if (!files.length || input.files.some((entry) => entry.field !== "files"))
      throw new Error("Choose signed receipt files.")
    if (files.some((entry) => !/\.(pdf|p7m)$/i.test(entry.name) || entry.size > 10 * 1024 * 1024)) {
      throw new Error("Choose PDFs or P7M files up to 10 MB each.")
    }
  } else if (path === "esign.documents.upload") {
    const pdf = single("file")
    if ((!pdf.name.toLowerCase().endsWith(".pdf") && pdf.type !== "application/pdf") || pdf.size > 30 * 1024 * 1024) {
      throw new Error("Choose a PDF up to 30 MB.")
    }
  } else {
    throw new Error("Unknown upload operation.")
  }
  return form
}
