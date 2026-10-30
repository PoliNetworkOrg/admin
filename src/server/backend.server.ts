import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import {
  createTRPCClient,
  createTRPCUntypedClient,
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  splitLink,
} from "@trpc/client"
import { SuperJSON } from "superjson"

import { env } from "@/env"

/**
 * A backend client for one request, carrying the signed-in user's access token (RFC v3 §11): the backend verifies it
 * and enforces the user's permissions. `null` only in agent mode, which has no token: the backend refuses its calls.
 */
export function createBackendClient(accessToken: string | null) {
  return createTRPCClient<AppRouter>({ links: backendLinks(accessToken) })
}

/**
 * The same connection without the router's types, for procedures the published `AppRouter` doesn't declare yet
 * (`people.*`). Callers must parse every response with the contract's schemas.
 */
export function createUntypedBackendClient(accessToken: string | null) {
  return createTRPCUntypedClient({ links: backendLinks(accessToken) })
}

function backendLinks(accessToken: string | null) {
  const headers = accessToken ? { authorization: `Bearer ${accessToken}` } : undefined
  const url = `${env.BACKEND_URL}${TRPC_PATH}`
  return [
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
  ]
}

export type BackendClient = ReturnType<typeof createBackendClient>
