"use server"

import type { AppRouter } from "@polinetwork/backend"
import { isTRPCClientError } from "@trpc/client"
import { getQueryClient, trpc } from "@/lib/trpc/server"

/**
 * Check if an email is linked to a registered user
 *
 * @param email The email string to check
 * @returns Whether an user exists with this email
 */
export async function checkEmail(email: string) {
  try {
    const qc = getQueryClient()
    const { exists } = await qc.fetchQuery(trpc.auth.checkEmail.queryOptions({ email }, { staleTime: Infinity }))
    return { exists, error: null }
  } catch (err: unknown) {
    if (!isTRPCClientError<AppRouter>(err) || !err.data) {
      console.log("Unknown error in checkEmail", err)
      return { exists: null, error: "There was an unexpected error" }
    }

    if (err.data.code === "BAD_REQUEST") return { exists: null, error: "Invalid email" }
    if (err.data.code === "TOO_MANY_REQUESTS") return { exists: null, error: err.message }
    return { exists: null, error: err.message }
  }
}
