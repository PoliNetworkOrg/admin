import "server-only" // <-- ensure this file cannot be imported from the client

import { type AppRouter, TRPC_PATH } from "@polinetwork/backend"
import { createTRPCClient, httpLink } from "@trpc/client"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { cache } from "react"
import SuperJSON from "superjson"
import { getBaseUrl } from "../utils"
import { makeQueryClient } from "./query-client"

const url = getBaseUrl() + TRPC_PATH
export const getQueryClient = cache(makeQueryClient)
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [httpLink({ url, transformer: SuperJSON })],
  }),
  queryClient: getQueryClient,
})
