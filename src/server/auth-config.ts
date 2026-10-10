import { z } from "zod"

const DEFAULT_IDP_URL = "https://auth.polinetwork.org"
const DEFAULT_BACKEND_RESOURCE = "https://backend.internal.polinetwork.org"
const DEVELOPMENT_REDIS_URL = "redis://localhost:6379"

/** The `admin-dashboard` client's signing key: a private JWK with `kid` and `alg` (`EdDSA` or `ES256`), as JSON. */
const privateJwkSchema = z
  .object({
    kty: z.enum(["OKP", "EC"]),
    crv: z.enum(["Ed25519", "P-256"]),
    alg: z.enum(["EdDSA", "ES256"]),
    kid: z.string().min(1),
    d: z.string().min(1),
    x: z.string().min(1),
    y: z.string().optional(),
  })
  .refine((jwk) => (jwk.alg === "EdDSA" ? jwk.crv === "Ed25519" : jwk.crv === "P-256" && jwk.y !== undefined), {
    message: "alg must match the key: EdDSA with Ed25519, ES256 with P-256",
  })

export type ClientPrivateJwk = z.infer<typeof privateJwkSchema>

export type ClientAuthentication =
  | { method: "private_key_jwt"; key: ClientPrivateJwk }
  | { method: "client_secret_basic"; secret: string }

export type AuthConfig = {
  /** The dashboard's public origin; the CSRF check and the redirect URIs are derived from it. */
  appOrigin: string
  redirectUri: string
  postLogoutRedirectUri: string
  /** `iss` of the IdP's tokens, also its discovery base. */
  internalIdpUrl?: string
  issuer: string
  /** The IdP's account page, where users link Telegram and manage passkeys. */
  accountUrl: string
  clientId: string
  clientAuthentication: ClientAuthentication
  /** `resource` (RFC 8707) of every authorization and token request: the backend's audience. */
  backendResource: string
  scopes: string
  redisUrl: string
  /** Encrypts the pre-login state cookie. */
  sessionSecret: string
  /** True on HTTPS: `Secure` cookies with the `__Host-`/`__Secure-` prefixes. */
  secureCookies: boolean
  sessionCookie: string
  loginCookie: string
}

export const SCOPES = "openid profile email offline_access backend:admin"
export const CALLBACK_PATH = "/auth/callback"

const sourceSchema = z.object({
  IDP_URL: z.url().default(DEFAULT_IDP_URL),
  IDP_INTERNAL_URL: z.url().optional(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_PRIVATE_JWK: z.string().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  BACKEND_RESOURCE: z.url().default(DEFAULT_BACKEND_RESOURCE),
  REDIS_URL: z.url().optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
})

const appUrlSchema = z.object({ APP_URL: z.url().optional(), PORT: z.string().optional() })

/** The dashboard's public origin: `APP_URL`, or `http://localhost:$PORT` in development. */
export function resolveAppOrigin(source: Record<string, string | undefined>, nodeEnv: string | undefined) {
  const env = appUrlSchema.parse(source)
  const appUrl = env.APP_URL ?? (nodeEnv === "development" ? `http://localhost:${env.PORT ?? "3001"}` : undefined)
  if (!appUrl) throw new Error("APP_URL is required outside development.")
  return new URL(appUrl).origin
}

function clientAuthentication(privateJwk: string | undefined, secret: string | undefined): ClientAuthentication {
  if (privateJwk && secret) throw new Error("Set only one of OIDC_CLIENT_PRIVATE_JWK and OIDC_CLIENT_SECRET.")
  if (privateJwk) {
    try {
      return { method: "private_key_jwt", key: privateJwkSchema.parse(JSON.parse(privateJwk)) }
    } catch (error) {
      // Never log the parser message: Node can include a prefix of the secret JSON in it.
      console.error(
        new Error(
          error instanceof Error ? `Invalid OIDC_CLIENT_PRIVATE_JWK (${error.name})` : "Invalid OIDC_CLIENT_PRIVATE_JWK"
        )
      )
      throw new Error("OIDC_CLIENT_PRIVATE_JWK must be a valid private Ed25519 or P-256 JWK.")
    }
  }
  if (secret) return { method: "client_secret_basic", secret }
  throw new Error("Set OIDC_CLIENT_PRIVATE_JWK (or OIDC_CLIENT_SECRET for a local IdP).")
}

/** Reads the OIDC and session settings; throws a message naming the missing or invalid variable. */
export function resolveAuthConfig(source: Record<string, string | undefined>, nodeEnv: string | undefined) {
  const env = sourceSchema.parse(source)
  const app = new URL(resolveAppOrigin(source, nodeEnv))
  const secureCookies = app.protocol === "https:"
  const redisUrl = env.REDIS_URL ?? (nodeEnv === "development" ? DEVELOPMENT_REDIS_URL : undefined)
  if (!redisUrl) throw new Error("REDIS_URL is required outside development.")
  if (!secureCookies && nodeEnv === "production") throw new Error("APP_URL must use HTTPS in production.")

  return {
    appOrigin: app.origin,
    redirectUri: new URL(CALLBACK_PATH, app.origin).href,
    postLogoutRedirectUri: new URL("/login", app.origin).href,
    internalIdpUrl: env.IDP_INTERNAL_URL,
    issuer: new URL("/api/auth", env.IDP_URL).href,
    accountUrl: new URL("/", env.IDP_URL).href,
    clientId: env.OIDC_CLIENT_ID,
    clientAuthentication: clientAuthentication(env.OIDC_CLIENT_PRIVATE_JWK, env.OIDC_CLIENT_SECRET),
    backendResource: env.BACKEND_RESOURCE,
    scopes: SCOPES,
    redisUrl,
    sessionSecret: env.SESSION_SECRET,
    secureCookies,
    // `__Host-`: Secure, Path=/, no Domain, so no subdomain can set or read it. Browsers reject the prefixes on HTTP.
    sessionCookie: secureCookies ? "__Host-pn-admin-session" : "pn-admin-session",
    loginCookie: secureCookies ? "__Secure-pn-admin-login" : "pn-admin-login",
  } satisfies AuthConfig
}
