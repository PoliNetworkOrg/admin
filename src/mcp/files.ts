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
  const validated = new FormData()
  if (path.startsWith("web.projects.")) {
    // The dashboard parser calls this logoFile; the backend multipart field is logo.
    const logo = form.get("logo")
    if (logo instanceof File) form.set("logoFile", logo)
    const parsed = parseProjectForm(form)
    if (files.length > 1 || input.files.some((entry) => entry.field !== "logo"))
      throw new Error("Choose at most one logo in the logo field.")
    if (path.endsWith("editProject")) {
      if (!/^[1-9]\d*$/.test(input.fields.id ?? "")) throw new Error("INVALID_ID")
      validated.set("id", input.fields.id)
    }
    validated.set("title", parsed.title)
    validated.set("descriptionIt", parsed.descriptionIt)
    validated.set("descriptionEn", parsed.descriptionEn)
    validated.set("link", parsed.link ?? "")
    validated.set("category", parsed.category)
    if (parsed.logoFile) validated.set("logo", parsed.logoFile)
  } else if (path === "web.associations.addAssociation" || path === "web.associations.editAssociation") {
    const parsed =
      path === "web.associations.addAssociation" ? parseCreateAssociationForm(form) : parseEditAssociationForm(form)
    if (files.length > 1 || input.files.some((entry) => entry.field !== "logo"))
      throw new Error("Choose at most one logo in the logo field.")
    if ("id" in parsed) validated.set("id", String(parsed.id))
    validated.set("name", parsed.name)
    validated.set("descriptionIt", parsed.descriptionIt)
    validated.set("descriptionEn", parsed.descriptionEn)
    if (parsed.logo instanceof File) validated.set("logo", parsed.logo)
  } else if (path === "web.guides_matricole.addGuide") {
    single("file")
    const parsed = parseGuideForm(form)
    validated.set("version", parsed.version)
    validated.set("date", parsed.date)
    validated.set("file", parsed.file)
  } else if (path === "people.census.importPreview") {
    const parsed = campaignInputSchema.parse({ campaignId: input.fields.campaignId })
    const file = single("file")
    await validateCensusImport(file)
    validated.set("campaignId", parsed.campaignId)
    validated.set("file", file)
  } else if (path === "people.me.uploadTransferReceipt") {
    const receipt = single("file")
    const parsed = transferInputSchema.parse({
      transferDate: input.fields.transferDate,
      amountCents: Number(input.fields.amountCents),
    })
    if (!/\.(pdf|jpe?g|png)$/i.test(receipt.name) || receipt.size > 10 * 1024 * 1024) {
      throw new Error("Choose a PDF, JPG or PNG up to 10 MB.")
    }
    validated.set("transferDate", parsed.transferDate)
    validated.set("amountCents", String(parsed.amountCents))
    validated.set("file", receipt)
  } else if (path === "people.receipts.previewSigned") {
    if (!files.length || input.files.some((entry) => entry.field !== "files"))
      throw new Error("Choose signed receipt files.")
    if (files.some((entry) => !/\.(pdf|p7m)$/i.test(entry.name) || entry.size > 10 * 1024 * 1024)) {
      throw new Error("Choose PDFs or P7M files up to 10 MB each.")
    }
    for (const file of files) validated.append("files", file)
  } else if (path === "esign.documents.upload") {
    const pdf = single("file")
    if ((!pdf.name.toLowerCase().endsWith(".pdf") && pdf.type !== "application/pdf") || pdf.size > 30 * 1024 * 1024) {
      throw new Error("Choose a PDF up to 30 MB.")
    }
    validated.set("file", pdf)
  } else {
    throw new Error("Unknown upload operation.")
  }
  return validated
}
