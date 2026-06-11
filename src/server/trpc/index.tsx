import "server-only"

import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { createTRPCClient, httpBatchLink, httpLink, isNonJsonSerializable, splitLink } from "@trpc/client"
import SuperJSON from "superjson"
import { env } from "@/env"

const url = env.BACKEND_URL + TRPC_PATH
export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => isNonJsonSerializable(op.input),
      true: httpLink({
        url,
        transformer: {
          // request - convert data before sending to the tRPC server
          serialize: (data) => data,
          // response - convert the tRPC response before using it in client
          deserialize: (data) => SuperJSON.deserialize(data), // or your other transformer
        },
      }),
      false: httpBatchLink({
        url,
        transformer: SuperJSON, // or your other transformer
      }),
    }),
  ],
})
