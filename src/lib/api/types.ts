import type { AppRouter } from "@polinetwork/backend"
import type { inferRouterError, inferRouterInputs, inferRouterOutputs } from "@trpc/server"

export type ApiOutput = inferRouterOutputs<AppRouter>
export type ApiInput = inferRouterInputs<AppRouter>
export type ApiError = inferRouterError<AppRouter>

export type TgUser = NonNullable<ApiOutput["tg"]["users"]["get"]["user"]>
export type TgGrant = NonNullable<ApiOutput["tg"]["grants"]["checkUser"]["grant"]>
export type TgGroup = ApiOutput["tg"]["groups"]["getAll"][number]
export type TgGroupLabel = ApiOutput["tg"]["groupLabels"]["getAll"][number]
export type TgUserRole = NonNullable<ApiInput["tg"]["permissions"]["addRole"]["role"]>

export type AzureMember = ApiOutput["azure"]["members"]["getAll"][number]
export type AzureGroup = ApiOutput["azure"]["groups"]["getAll"][number]

export type FAQs = ApiOutput["web"]["faqs"]["getAllFaqs"]
export type FAQItem = FAQs[number]["faqs"][number]
export type WebProject = ApiOutput["web"]["projects"]["getAllProjects"][number]

export type WaGroup = ApiOutput["wa"]["groups"]["getAll"][number]

/** A group (Telegram or WhatsApp) with its labels already resolved, from the cross-platform search router. */
export type GroupWithLabels = ApiOutput["groups"]["search"]["getAll"][number]
