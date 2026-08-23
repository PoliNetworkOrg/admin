import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from "@trpc/client"
import { SuperJSON } from "superjson"

import { env } from "@/env"
import { getForwardedCookieHeaders } from "@/server/request-headers"

export function createBackendClient(requestHeaders: Headers) {
  const headers = getForwardedCookieHeaders(requestHeaders)
  const url = `${env.BACKEND_URL}${TRPC_PATH}`

  return createTRPCClient<AppRouter>({
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
}

export type BackendClient = ReturnType<typeof createBackendClient>
