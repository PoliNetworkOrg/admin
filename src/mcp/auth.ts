import { createHash, randomUUID } from "node:crypto"
import { chmod, lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import * as oidc from "openid-client"
import { z } from "zod"

import { MCP_CALLBACK, mcpConfigSchema, type McpConfig, publicOrigin, signerProfileSchema } from "./protocol"

const storedSchema = z.object({
  origin: z.string(),
  config: mcpConfigSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number(),
  sub: z.string().min(1),
  profile: signerProfileSchema,
  /** Written before refreshing: an interrupted refresh must never replay a rotating refresh token. */
  refreshing: z.boolean().default(false),
})
type StoredSession = z.infer<typeof storedSchema>

async function configuration(config: McpConfig) {
  const issuer = new URL(config.issuer)
  publicOrigin(issuer.origin)
  return oidc.discovery(issuer, config.clientId, { token_endpoint_auth_method: "none" }, oidc.None(), {
    execute:
      issuer.protocol === "http:"
        ? [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks]
        : [oidc.enableNonRepudiationChecks],
    timeout: 10,
  })
}

/** This public, downloadable native client has no client secret or dashboard session. */
export class AdminMcpAuth {
  readonly origin: string
  readonly file: string
  private pendingToken: Promise<string> | null = null

  constructor(origin: string, directory = join(homedir(), ".polinetwork", "admin-mcp")) {
    this.origin = publicOrigin(origin)
    const key = createHash("sha256").update(this.origin).digest("hex").slice(0, 24)
    this.file = join(directory, `${key}.json`)
  }

  private async lock() {
    const directory = dirname(this.file)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const stat = await lstat(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("The credential directory must be a real directory.")
    await chmod(directory, 0o700)
    try {
      await mkdir(`${this.file}.lock`, { mode: 0o700 })
    } catch (error) {
      console.error(new Error(error instanceof Error ? error.name : "The credential store is locked."))
      throw new Error(
        "Another admin MCP process is signing in or refreshing. Try again after it finishes. If it crashed, remove the .lock directory next to the credential file.",
        { cause: error }
      )
    }
    return () => rm(`${this.file}.lock`, { recursive: true, force: true })
  }

  private async read(): Promise<StoredSession> {
    const stat = await lstat(this.file)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) throw new Error("Invalid credential file.")
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
      throw new Error("Credential file must have mode 0600.")
    const session = storedSchema.parse(JSON.parse(await readFile(this.file, "utf8")))
    if (session.origin !== this.origin) throw new Error("The stored session belongs to another admin server.")
    return session
  }

  private async save(session: StoredSession) {
    const temporary = `${this.file}.${randomUUID()}.tmp`
    try {
      const file = await open(temporary, "wx", 0o600)
      try {
        await file.writeFile(JSON.stringify(session))
        await file.sync()
      } finally {
        await file.close()
      }
      await rename(temporary, this.file)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  async login(onAuthorization: (url: URL) => void | Promise<void>) {
    const unlock = await this.lock()
    const callback = new URL(MCP_CALLBACK)
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const verifier = oidc.randomPKCECodeVerifier()
    const listener = createServer()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const response = await fetch(`${this.origin}/api/mcp/config`, {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        credentials: "omit",
      })
      if (!response.ok)
        throw new Error(
          "Admin MCP is not configured on this server. An administrator must register its public OAuth client."
        )
      const config = mcpConfigSchema.parse(await response.json())
      const discovered = await configuration(config)
      await new Promise<void>((resolve, reject) => {
        listener.once("error", reject)
        listener.listen(Number(callback.port), callback.hostname, () => {
          listener.removeListener("error", reject)
          resolve()
        })
      })
      const authorization = oidc.buildAuthorizationUrl(discovered, {
        redirect_uri: MCP_CALLBACK,
        scope: "openid profile email offline_access backend:admin",
        resource: config.resource,
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      })
      const completed = new Promise<URL>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Sign-in timed out. Run login again.")), 5 * 60_000)
        listener.on("request", (request, reply) => {
          const url = new URL(request.url ?? "/", callback)
          const valid =
            request.method === "GET" &&
            request.headers.host === callback.host &&
            url.origin === callback.origin &&
            url.pathname === callback.pathname &&
            url.searchParams.get("state") === state
          reply.writeHead(valid ? 200 : 400, {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "content-security-policy": "default-src 'none'",
            "referrer-policy": "no-referrer",
          })
          reply.end(
            valid ? "Return to the terminal to finish connecting PoliNetwork Admin." : "Invalid sign-in callback."
          )
          if (valid) resolve(url)
        })
      })
      // Attach the callback waiter before opening the browser, including for fast local test providers.
      const [url] = await Promise.all([completed, onAuthorization(authorization)])
      const requestedAt = Date.now()
      const tokens = await oidc.authorizationCodeGrant(
        discovered,
        url,
        {
          pkceCodeVerifier: verifier,
          expectedState: state,
          expectedNonce: nonce,
          idTokenExpected: true,
        },
        { resource: config.resource }
      )
      const sub = z.string().min(1).parse(tokens.claims()?.sub)
      const profile = signerProfileSchema.parse({
        name: tokens.claims()?.name ?? "",
        email: tokens.claims()?.email ?? null,
      })
      if (!tokens.refresh_token || !tokens.expires_in)
        throw new Error("The IdP must issue refresh tokens and an access-token lifetime.")
      await this.save({
        origin: this.origin,
        config,
        sub,
        profile,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: requestedAt + tokens.expires_in * 1000,
        refreshing: false,
      })
    } catch (error) {
      console.error(new Error(error instanceof Error ? error.name : "Sign-in failed"))
      throw new Error(
        "Sign-in failed. Check the public client's callback, scopes and backend resource, then run login again."
      )
    } finally {
      clearTimeout(timer)
      listener.closeAllConnections()
      if (listener.listening) await new Promise<void>((resolve) => listener.close(() => resolve()))
      await unlock()
    }
  }

  accessToken() {
    this.pendingToken ??= this.freshToken().finally(() => {
      this.pendingToken = null
    })
    return this.pendingToken
  }

  async signerProfile() {
    return (await this.read()).profile
  }

  private async freshToken() {
    const current = await this.read()
    if (current.refreshing) throw new Error("The last refresh was interrupted. Run login again.")
    if (current.expiresAt > Date.now() + 30_000) return current.accessToken
    const unlock = await this.lock()
    try {
      const stored = await this.read()
      if (stored.refreshing) throw new Error("The last refresh was interrupted. Run login again.")
      if (stored.expiresAt > Date.now() + 30_000) return stored.accessToken
      const discovered = await configuration(stored.config)
      await this.save({ ...stored, refreshing: true })
      const requestedAt = Date.now()
      const tokens = await oidc.refreshTokenGrant(discovered, stored.refreshToken, { resource: stored.config.resource })
      if (!tokens.expires_in || (tokens.id_token && tokens.claims()?.sub !== stored.sub))
        throw new Error("Invalid refreshed identity.")
      const session = {
        ...stored,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? stored.refreshToken,
        expiresAt: requestedAt + tokens.expires_in * 1000,
        refreshing: false,
      }
      await this.save(session)
      return session.accessToken
    } catch (error) {
      console.error(new Error(error instanceof Error ? error.name : "Session unavailable"))
      throw new Error("Admin MCP session unavailable. Run login again if sign-in expired or refresh was interrupted.")
    } finally {
      await unlock()
    }
  }

  async logout() {
    const unlock = await this.lock()
    try {
      const stored = await this.read()
      const discovered = await configuration(stored.config)
      await oidc.tokenRevocation(discovered, stored.refreshToken, { token_type_hint: "refresh_token" })
    } catch (error) {
      console.error(new Error(error instanceof Error ? error.name : "Revocation failed"))
      throw new Error(
        "Remote revocation failed; local credentials were removed. Revoke this application's consent in PoliNetwork Auth."
      )
    } finally {
      await rm(this.file, { force: true })
      await unlock()
    }
  }
}
