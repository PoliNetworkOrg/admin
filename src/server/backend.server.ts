import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from "@trpc/client"
import { SuperJSON } from "superjson"

import { env } from "@/env"

/**
 * A backend client for one request, carrying the signed-in user's access token (RFC v3 §11): the backend verifies it
 * and enforces the user's permissions. `null` only in agent mode, which uses the backend's legacy anonymous path.
 */
export function createBackendClient(accessToken: string | null) {
  const headers = accessToken ? { authorization: `Bearer ${accessToken}` } : undefined
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
