import { TRPC_PATH, type AppRouter } from "@polinetwork/backend";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { getBaseUrl } from "./utils";

const url = getBaseUrl() + TRPC_PATH;
export const api = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url })],
});
