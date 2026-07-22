import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { getRequestHeader } from "@tanstack/react-start/server"
import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from "@trpc/client"
import { SuperJSON } from "superjson"
import { env } from "@/env"

const url = `${env.BACKEND_URL}${TRPC_PATH}`
const cookie = getRequestHeader("cookie")
const headers = cookie ? { cookie } : {}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (operation) => isNonJsonSerializable(operation.input),
      true: httpLink({
        url,
        headers,
        transformer: {
          serialize: (data) => data,
          deserialize: (data) => SuperJSON.deserialize(data),
        },
      }),
      false: httpBatchLink({ url, headers, transformer: SuperJSON }),
    }),
  ],
})
