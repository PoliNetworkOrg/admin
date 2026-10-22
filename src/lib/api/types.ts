import type { AppRouter } from "@polinetwork/backend"
import type { inferRouterOutputs } from "@trpc/server"

import type { ReceiptRequestSource } from "@/features/people/people.contract"

export type ApiOutput = inferRouterOutputs<AppRouter>

export type TgUser = NonNullable<ApiOutput["tg"]["users"]["get"]["user"]>
export type TgGrant = NonNullable<ApiOutput["tg"]["grants"]["checkUser"]["grant"]>
export type TgGroup = ApiOutput["tg"]["groups"]["getAll"][number]
export type TgGroupLabel = ApiOutput["groups"]["labels"]["getAll"][number]

export type AzureMember = ApiOutput["azure"]["members"]["getAll"][number]
export type AzureGroup = ApiOutput["azure"]["groups"]["getAll"][number]

export type FAQs = ApiOutput["web"]["faqs"]["getAllFaqs"]
export type FAQItem = FAQs[number]["faqs"][number]
export type WebProject = ApiOutput["web"]["projects"]["getAllProjects"][number]

export type WaGroup = ApiOutput["wa"]["groups"]["getAll"][number]

/** A group (Telegram or WhatsApp) with its labels already resolved, from the cross-platform search router. */
export type GroupWithLabels = ApiOutput["groups"]["search"]["getAll"][number]

export type GroupLinkReport = ApiOutput["web"]["reports"]["list"][number]

export type EsignRequest = ApiOutput["esign"]["requests"]["list"][number] & {
  peopleReceipt?: ReceiptRequestSource | null
}
export type EsignRequestDetail = ApiOutput["esign"]["requests"]["get"]
/** A version of a request's PDF, or a PDF staged for a new request. */
export type EsignDocumentMeta = EsignRequestDetail["versions"][number]
export type EsignSigner = EsignRequest["signers"][number]
export type EsignProfile = ApiOutput["esign"]["signers"]["list"][number]
export type EsignPdfInfo = ApiOutput["esign"]["documents"]["get"]["pdf"]
export type EsignDriveListing = ApiOutput["esign"]["drive"]["list"]
export type EsignDriveItem = EsignDriveListing["items"][number]
export type EsignConfig = ApiOutput["esign"]["config"]
export type EsignDrive = EsignConfig["drives"][number]
