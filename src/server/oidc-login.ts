import { z } from "zod"

import type { SessionTokens, SessionUser } from "./session.ts"

/**
 * The authorization-code round trip (RFC v3 §11.1). `state`, `nonce` and the PKCE verifier travel in a short-lived,
 * encrypted cookie scoped to the callback path, so nothing is stored on the server before sign-in.
 */

export const LOGIN_STATE_MAX_AGE_S = 10 * 60
export const DEFAULT_RETURN_TO = "/dashboard"

export type LoginState = {
  state: string
  nonce: string
  codeVerifier: string
  returnTo: string
  /** Epoch milliseconds. */
  expiresAt: number
}

const IV_BYTES = 12
const encoder = new TextEncoder()

async function loginStateKey(secret: string) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode("pn-admin/login-state/v1") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/** AES-256-GCM, so the cookie can be neither read nor altered by the browser. */
export async function sealLoginState(loginState: LoginState, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await loginStateKey(secret),
    encoder.encode(JSON.stringify(loginState))
  )
  return Buffer.concat([iv, new Uint8Array(sealed)]).toString("base64url")
}

const loginStateSchema = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(1),
  returnTo: z.string(),
  expiresAt: z.number(),
})

/** The sealed state, or null when it is missing, altered, expired or sealed with another secret. */
export async function openLoginState(value: string | undefined, secret: string, now: number) {
  if (!value) return null
  try {
    const bytes = Buffer.from(value, "base64url")
    if (bytes.length <= IV_BYTES) return null
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, IV_BYTES) },
      await loginStateKey(secret),
      bytes.subarray(IV_BYTES)
    )
    const parsed = loginStateSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)))
    if (!parsed.success || parsed.data.expiresAt <= now) return null
    return parsed.data
  } catch (error) {
    // A failed decryption is an expected outcome (stale cookie, rotated secret); it is still logged.
    console.error(error)
    return null
  }
}

/** Only same-origin paths, so `returnTo` can't send a freshly signed-in user to another site. */
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return DEFAULT_RETURN_TO
  try {
    const base = new URL("https://admin.invalid")
    const url = new URL(value, base)
    if (url.origin !== base.origin) return DEFAULT_RETURN_TO
    return `${url.pathname}${url.search}${url.hash}`
  } catch (error) {
    console.error(error)
    return DEFAULT_RETURN_TO
  }
}

export type LoginFailure = "missing-state" | "state-mismatch" | "denied" | "exchange-failed"

export type ExchangedLogin = { tokens: SessionTokens; user: SessionUser; sid: string | null }

export type LoginResult =
  | { status: "signed-in"; login: ExchangedLogin; returnTo: string }
  | { status: "failed"; reason: LoginFailure }

type CompleteLoginOptions = {
  callbackUrl: URL
  loginState: LoginState | null
  /**
   * Exchanges the code with `resource` and validates the ID token (`iss`, `aud`, `exp`, `nonce`); rejects when any
   * check fails. It is only called once `state` matches the cookie.
   */
  exchange: (callbackUrl: URL, checks: Pick<LoginState, "state" | "nonce" | "codeVerifier">) => Promise<ExchangedLogin>
}

export async function completeLogin({ callbackUrl, loginState, exchange }: CompleteLoginOptions): Promise<LoginResult> {
  if (!loginState) return { status: "failed", reason: "missing-state" }
  if (callbackUrl.searchParams.get("state") !== loginState.state) return { status: "failed", reason: "state-mismatch" }
  if (callbackUrl.searchParams.has("error")) return { status: "failed", reason: "denied" }
  try {
    const login = await exchange(callbackUrl, {
      state: loginState.state,
      nonce: loginState.nonce,
      codeVerifier: loginState.codeVerifier,
    })
    return { status: "signed-in", login, returnTo: safeReturnTo(loginState.returnTo) }
  } catch (error) {
    console.error(error)
    return { status: "failed", reason: "exchange-failed" }
  }
}
