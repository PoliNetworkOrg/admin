import type { AppRouter } from "@polinetwork/backend"
import type { inferRouterError, inferRouterInputs, inferRouterOutputs } from "@trpc/server"

export type ApiOutput = inferRouterOutputs<AppRouter>
export type ApiInput = inferRouterInputs<AppRouter>
export type ApiError = inferRouterError<AppRouter>
