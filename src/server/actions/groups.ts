"use server"

import { trpc } from "../trpc"

export async function searchGroup(query: string) {
  return trpc.tg.groups.search.query({ query, limit: 20, showHidden: true })
}
