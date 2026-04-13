import "server-only"

import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import SuperJSON from "superjson"
import { env } from "@/env"

const url = env.BACKEND_URL + TRPC_PATH
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url,
      transformer: SuperJSON,
    }),
  ],
})
