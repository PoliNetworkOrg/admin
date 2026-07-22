import type { AppRouter } from "@polinetwork/backend"
import type { inferRouterError, inferRouterInputs, inferRouterOutputs } from "@trpc/server"
import type { trpc } from "."

export type ApiOutput = inferRouterOutputs<AppRouter>
export type ApiInput = inferRouterInputs<AppRouter>
export type ApiError = inferRouterError<AppRouter>

export type TgUser = NonNullable<ApiOutput["tg"]["users"]["get"]["user"]>
export type TgGrant = NonNullable<ApiOutput["tg"]["grants"]["checkUser"]["grant"]>
export type TgGroup = NonNullable<ApiOutput["tg"]["groups"]["search"]["groups"][number]>
export type TgUserRole = NonNullable<ApiInput["tg"]["permissions"]["addRole"]["role"]>

export type AzureMember = ApiOutput["azure"]["members"]["getAll"][number]
export type AzureGroup = ApiOutput["azure"]["groups"]["getAll"][number]

export type FAQs = Awaited<ReturnType<typeof trpc.web.faqs.getAllFaqs.query>>
export type FAQItem = FAQs[number]["faqs"][number]
