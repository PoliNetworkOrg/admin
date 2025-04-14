import 'server-only'; // <-- ensure this file cannot be imported from the client

import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { makeQueryClient } from './query-client';
import { createTRPCClient, httpLink } from '@trpc/client';
import { TRPC_PATH, type AppRouter } from '@polinetwork/backend';
import { getBaseUrl } from '../utils';

const url = getBaseUrl() + TRPC_PATH;
export const getQueryClient = cache(makeQueryClient);
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [httpLink({ url })],
  }),
  queryClient: getQueryClient,
});
