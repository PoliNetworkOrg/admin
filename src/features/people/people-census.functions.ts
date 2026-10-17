import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { peopleReadMiddleware, peopleWriteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { campaignInputSchema, importCommitInputSchema, remindInputSchema } from "./people.contract"

const IMPORT_MAX_SIZE = 10 * 1024 * 1024
const IMPORT_EXTENSIONS = /\.(xlsx|csv)$/i

export const getCampaigns = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .handler(async ({ context }) => (await peopleApi(context)).listCampaigns())

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([peopleReadMiddleware])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => (await peopleApi(context)).getCampaign(data.id))

/** Everyone without an answer, or one person; the backend skips people reminded in the last 3 days. */
export const sendCensusReminders = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(remindInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).remind(data))

export const closeCampaign = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(campaignInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).closeCampaign(data.campaignId))

/** Uploads the Forms export; the backend parses it and returns the preview the wizard renders. Nothing is saved yet. */
export const previewCensusImport = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator((data: FormData) => {
    const campaignId = z.string().min(1).safeParse(data.get("campaignId"))
    const file = data.get("file")
    if (!campaignId.success) throw new Error("Choose a campaign.")
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose the Forms export.")
    if (!IMPORT_EXTENSIONS.test(file.name)) throw new Error("Choose an .xlsx or .csv file.")
    if (file.size > IMPORT_MAX_SIZE) throw new Error("The file is larger than 10 MB.")
    return { campaignId: campaignId.data, file }
  })
  .handler(async ({ data, context }) => (await peopleApi(context)).importPreview(data.campaignId, data.file))

/** Applies a previewed import with the duplicate and Telegram choices made in the wizard. */
export const commitCensusImport = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(importCommitInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).importCommit(data))
