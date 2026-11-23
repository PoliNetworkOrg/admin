import { createHash, randomUUID } from "node:crypto"
import { lstatSync, rmSync } from "node:fs"
import { chmod, lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import type * as Oidc from "openid-client"
import { z } from "zod"

import { MCP_CALLBACK, MCP_CONFIG_PATH, mcpConfigSchema, type McpConfig, publicOrigin } from "../protocol.ts"

/** The bridge cannot authenticate: the user must run `login` (again). Its message is shown to the agent. */
export class SignInRequired extends Error {}

export const LOGIN_HINT = "Run `polinetwork-admin-mcp login` in a terminal, then restart the MCP server in your client."

const storedSchema = z.object({
  origin: z.string(),
  config: mcpConfigSchema,
  sub: z.string().min(1),
  name: z.string(),
  email: z.string(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** The MCP client's ID token: the admin reads the caller's name and email from it. */
  idToken: z.string().min(1),
  expiresAt: z.number(),
  /** Written before refreshing: an interrupted refresh must never replay a rotating refresh token. */
  refreshing: z.boolean(),
})
type StoredSession = z.infer<typeof storedSchema>

export type BridgeCredentials = { accessToken: string; idToken: string }

const identitySchema = z.object({ sub: z.string().min(1), name: z.string().optional(), email: z.string().optional() })

/** Refresh this long before expiry, so a token never expires in flight. */
const EXPIRY_MARGIN_MS = 30_000
const LOCK_WAIT_MS = 10_000
const MAX_FILE_BYTES = 64 * 1024

/** Lock directories this process holds, removed even when it is terminated mid-refresh. */
const heldLocks = new Set<string>()
let exitHookInstalled = false

function installExitHook() {
  if (exitHookInstalled) return
  exitHookInstalled = true
  process.once("exit", () => {
    for (const lock of heldLocks) rmSync(lock, { recursive: true, force: true })
  })
}

function errorCode(error: Error) {
  return "code" in error ? error.code : undefined
}

/** Whether `pid` names a running process (signal 0 only checks; EPERM means it exists under another user). */
function running(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error instanceof Error && errorCode(error) === "EPERM") return true
    console.error(error)
    return false
  }
}

async function loadOidc() {
  return import("openid-client")
}

async function discover(oidc: typeof Oidc, config: McpConfig) {
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

export type AuthStatus =
  | { signedIn: false; file: string; reason: string }
  | {
      signedIn: true
      file: string
      sub: string
      name: string
      email: string
      expiresAt: number
      /** A refresh was interrupted: the next request needs a new login. */
      interrupted: boolean
    }

/**
 * The downloadable public native client: no client secret, no dashboard session. Credentials for each admin origin
 * live in one private file, written atomically; a lock directory makes the processes of one user (clients often
 * start several `serve`) take turns refreshing, so a rotating refresh token is used once.
 */
export class AdminMcpAuth {
  readonly origin: string
  readonly file: string
  private readonly lockPath: string

  constructor(origin: string, directory = join(homedir(), ".polinetwork", "admin-mcp")) {
    this.origin = publicOrigin(origin)
    const key = createHash("sha256").update(this.origin).digest("hex").slice(0, 24)
    this.file = join(directory, `${key}.json`)
    this.lockPath = `${this.file}.lock`
  }

  private async directory() {
    const directory = dirname(this.file)
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const stat = await lstat(directory)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`${directory} must be a real directory, not a link.`)
    }
    if (process.platform !== "win32") await chmod(directory, 0o700)
  }

  /** Takes the cross-process lock, waiting up to `waitMs` for another process; a dead holder's lock is removed. */
  async lock(waitMs = LOCK_WAIT_MS) {
    await this.directory()
    const deadline = Date.now() + waitMs
    for (;;) {
      try {
        await mkdir(this.lockPath, { mode: 0o700 })
        break
      } catch (error) {
        if (!(error instanceof Error) || errorCode(error) !== "EEXIST") throw error
        if (await this.staleLock()) {
          await rm(this.lockPath, { recursive: true, force: true })
          continue
        }
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          console.error(error)
          throw new SignInRequired(
            `Another polinetwork-admin-mcp process is signing in or refreshing. Try again when it finishes; if none is running, remove ${this.lockPath}.`
          )
        }
        await delay(Math.min(100, remaining))
      }
    }
    heldLocks.add(this.lockPath)
    installExitHook()
    try {
      await writeFile(join(this.lockPath, "owner"), String(process.pid), { mode: 0o600 })
    } catch (error) {
      console.error(error)
      await this.unlock()
      throw error
    }
    return () => this.unlock()
  }

  private async unlock() {
    heldLocks.delete(this.lockPath)
    await rm(this.lockPath, { recursive: true, force: true })
  }

  /** A lock whose owner process has exited. A lock without an owner yet is being created: not stale. */
  private async staleLock() {
    try {
      const pid = Number(await readFile(join(this.lockPath, "owner"), "utf8"))
      return Number.isInteger(pid) && pid > 0 && pid !== process.pid && !running(pid)
    } catch (error) {
      console.error(error)
      return false
    }
  }

  private async read(): Promise<StoredSession> {
    const stat = lstatSync(this.file, { throwIfNoEntry: false })
    if (!stat) throw new SignInRequired(`Not signed in to ${this.origin}. ${LOGIN_HINT}`)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) {
      throw new SignInRequired(`${this.file} is not a credential file. Remove it, then ${LOGIN_HINT}`)
    }
    if (process.platform !== "win32" && (stat.mode & 0o077) !== 0) {
      throw new SignInRequired(`${this.file} must be readable only by you (mode 0600). ${LOGIN_HINT}`)
    }
    const invalid = `The credentials for ${this.origin} are invalid. ${LOGIN_HINT}`
    let content: z.core.util.JSONType
    try {
      content = z.json().parse(JSON.parse(await readFile(this.file, "utf8")))
    } catch (error) {
      // Never log the parser's message: Node can quote a piece of the file, which holds the tokens.
      console.error(
        new Error(error instanceof Error ? `Unreadable credential file (${error.name})` : "Unreadable file")
      )
      throw new SignInRequired(invalid)
    }
    const parsed = storedSchema.safeParse(content)
    if (!parsed.success || parsed.data.origin !== this.origin) throw new SignInRequired(invalid)
    return parsed.data
  }

  /** Atomic replace: a temporary file with mode 0600, synced, then renamed over the old one. */
  private async save(session: StoredSession) {
    await this.directory()
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

  /**
   * Credentials for the next request. `rejected` is an access token the admin refused: it is refreshed even if it
   * has not expired yet, unless another process already replaced it.
   */
  async credentials(rejected?: string): Promise<BridgeCredentials> {
    const current = await this.read()
    if (usable(current, rejected)) return { accessToken: current.accessToken, idToken: current.idToken }
    const unlock = await this.lock()
    try {
      const stored = await this.read()
      if (usable(stored, rejected)) return { accessToken: stored.accessToken, idToken: stored.idToken }
      if (stored.refreshing) throw new SignInRequired(`The last token refresh was interrupted. ${LOGIN_HINT}`)
      return await this.refresh(stored)
    } finally {
      await unlock()
    }
  }

  private async refresh(stored: StoredSession): Promise<BridgeCredentials> {
    let discovered: Oidc.Configuration
    const oidc = await loadOidc()
    try {
      discovered = await discover(oidc, stored.config)
    } catch (error) {
      // Nothing was sent with the refresh token yet: the next request may try again.
      console.error(error)
      throw new SignInRequired("PoliNetwork Auth is unreachable, so the session could not be renewed. Try again.")
    }
    await this.save({ ...stored, refreshing: true })
    try {
      const requestedAt = Date.now()
      const tokens = await oidc.refreshTokenGrant(discovered, stored.refreshToken, {
        resource: stored.config.resource,
      })
      if (!tokens.expires_in) throw new Error("The refresh response has no expires_in.")
      const claims = tokens.id_token ? identitySchema.parse(tokens.claims()) : null
      if (claims && claims.sub !== stored.sub) throw new Error("The refreshed ID token names another account.")
      const session: StoredSession = {
        ...stored,
        name: claims?.name ?? stored.name,
        email: claims?.email ?? stored.email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? stored.refreshToken,
        idToken: tokens.id_token ?? stored.idToken,
        expiresAt: requestedAt + tokens.expires_in * 1000,
        refreshing: false,
      }
      await this.save(session)
      return { accessToken: session.accessToken, idToken: session.idToken }
    } catch (error) {
      // The refresh token may have been rotated even if the answer was lost: never send it again.
      console.error(error)
      throw new SignInRequired(`The session could not be renewed. ${LOGIN_HINT}`)
    }
  }

  /**
   * Signs in with the system browser: authorization code with PKCE (S256), state and nonce, a signature-checked ID
   * token, and the backend resource; the loopback callback is the public client's registered redirect URI.
   */
  async login(onAuthorization: (url: URL) => void | Promise<void>, fetchConfig = fetchMcpConfig) {
    const config = await fetchConfig(this.origin)
    const oidc = await loadOidc()
    const discovered = await discover(oidc, config)
    const { createServer } = await import("node:http")
    const callback = new URL(MCP_CALLBACK)
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const verifier = oidc.randomPKCECodeVerifier()
    const listener = createServer()
    let timer: NodeJS.Timeout | undefined
    const unlock = await this.lock()
    try {
      await new Promise<void>((resolve, reject) => {
        listener.once("error", reject)
        listener.listen(Number(callback.port), callback.hostname, () => {
          listener.removeListener("error", reject)
          resolve()
        })
      })
      const authorization = oidc.buildAuthorizationUrl(discovered, {
        redirect_uri: MCP_CALLBACK,
        scope: config.scope,
        resource: config.resource,
        state,
        nonce,
        prompt: "consent",
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      })
      const completed = new Promise<URL>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Sign-in timed out after 5 minutes. Run login again.")), 5 * 60_000)
        listener.on("request", (request, reply) => {
          const target = request.url ?? "/"
          const url = URL.canParse(target, callback) ? new URL(target, callback) : null
          const valid =
            url !== null &&
            request.method === "GET" &&
            request.headers.host === callback.host &&
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
      // The callback waiter is attached before the browser opens.
      const [url] = await Promise.all([completed, onAuthorization(authorization)])
      const requestedAt = Date.now()
      const tokens = await oidc.authorizationCodeGrant(
        discovered,
        url,
        { pkceCodeVerifier: verifier, expectedState: state, expectedNonce: nonce, idTokenExpected: true },
        { resource: config.resource }
      )
      const claims = identitySchema.parse(tokens.claims())
      if (!tokens.refresh_token || !tokens.expires_in || !tokens.id_token) {
        throw new Error("PoliNetwork Auth must issue an ID token, a refresh token and the access token's lifetime.")
      }
      await this.save({
        origin: this.origin,
        config,
        sub: claims.sub,
        name: claims.name ?? "",
        email: claims.email ?? "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresAt: requestedAt + tokens.expires_in * 1000,
        refreshing: false,
      })
      return { name: claims.name ?? claims.sub, email: claims.email ?? "" }
    } finally {
      clearTimeout(timer)
      listener.closeAllConnections()
      if (listener.listening) await new Promise<void>((resolve) => listener.close(() => resolve()))
      await unlock()
    }
  }

  /** Revokes the refresh token and removes the local credentials, even when Auth cannot be reached. */
  async logout() {
    const unlock = await this.lock()
    try {
      const stored = await this.read()
      const oidc = await loadOidc()
      await oidc.tokenRevocation(await discover(oidc, stored.config), stored.refreshToken, {
        token_type_hint: "refresh_token",
      })
      return { revoked: true }
    } catch (error) {
      if (error instanceof SignInRequired) return { revoked: true }
      console.error(error)
      return { revoked: false }
    } finally {
      await rm(this.file, { force: true })
      await unlock()
    }
  }

  async status(): Promise<AuthStatus> {
    try {
      const stored = await this.read()
      return {
        signedIn: true,
        file: this.file,
        sub: stored.sub,
        name: stored.name,
        email: stored.email,
        expiresAt: stored.expiresAt,
        interrupted: stored.refreshing,
      }
    } catch (error) {
      console.error(error)
      if (!(error instanceof SignInRequired)) throw error
      return { signedIn: false, file: this.file, reason: error.message }
    }
  }
}

function usable(session: StoredSession, rejected: string | undefined) {
  return !session.refreshing && session.accessToken !== rejected && session.expiresAt > Date.now() + EXPIRY_MARGIN_MS
}

/** The admin's public client manifest; 503 until an administrator registers the public client. */
export async function fetchMcpConfig(origin: string): Promise<McpConfig> {
  const response = await fetch(`${origin}${MCP_CONFIG_PATH}`, {
    redirect: "error",
    credentials: "omit",
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 503) {
    throw new Error(`The admin MCP is not enabled on ${origin} yet: an administrator must register its OAuth client.`)
  }
  if (!response.ok) throw new Error(`${origin}${MCP_CONFIG_PATH} answered HTTP ${response.status}.`)
  return mcpConfigSchema.parse(await response.json())
}
