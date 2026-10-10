import * as client from "openid-client"
import { z } from "zod"

import type { AuthConfig, ClientAuthentication, ClientPrivateJwk } from "@/server/auth-config"
import type { ExchangedLogin, LoginState } from "@/server/oidc-login"
import type { RefreshResult, SessionRecord } from "@/server/session"

/**
 * The dashboard as a confidential OIDC client of the IdP (RFC v3 §7.3, §11), through `openid-client`: discovery, the
 * authorization code flow with PKCE and `resource`, ID-token validation, refresh, revocation and RP-initiated logout.
 */

/** Seconds; also applied to every request made with the discovered configuration. */
const REQUEST_TIMEOUT_S = 10

async function signingKey(jwk: ClientPrivateJwk): Promise<client.PrivateKey> {
  const algorithm = jwk.alg === "EdDSA" ? { name: "Ed25519" } : { name: "ECDSA", namedCurve: "P-256" }
  const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["sign"])
  return { key, kid: jwk.kid }
}

async function clientAuthentication(authentication: ClientAuthentication, issuer: string): Promise<client.ClientAuth> {
  if (authentication.method === "client_secret_basic") return client.ClientSecretBasic(authentication.secret)
  const key = await signingKey(authentication.key)
  return (metadata, clientMetadata, body, headers) =>
    client.PrivateKeyJwt(key, {
      [client.modifyAssertion]: (header, payload) => {
        // The IdP requires its public endpoint audience, regardless of the internal transport URL.
        if (header.alg === "Ed25519") header.alg = "EdDSA"
        payload.aud = `${issuer}/oauth2/${body.has("token") ? "revoke" : "token"}`
      },
    })(metadata, clientMetadata, body, headers)
}

/** Rewrite only transport URLs. Metadata, browser redirects, JWT issuer and assertion audience stay public. */
export function idpFetch(config: AuthConfig): client.CustomFetch {
  return (url, options) => {
    const target = new URL(url)
    const issuer = new URL(config.issuer)
    if (config.internalIdpUrl && target.origin === issuer.origin) {
      const internal = new URL(config.internalIdpUrl)
      target.protocol = internal.protocol
      target.host = internal.host
    }
    return fetch(target, {
      ...options,
      body: options.body instanceof Uint8Array ? new Uint8Array(options.body) : options.body,
    })
  }
}

async function discover(config: AuthConfig) {
  const issuer = new URL(config.issuer)
  return client.discovery(
    issuer,
    config.clientId,
    undefined,
    await clientAuthentication(config.clientAuthentication, config.issuer),
    {
      // Only a local IdP runs on plain HTTP; `resolveAuthConfig` already requires HTTPS for the dashboard in production.
      execute:
        issuer.protocol === "http:"
          ? [client.allowInsecureRequests, client.enableNonRepudiationChecks]
          : [client.enableNonRepudiationChecks],
      timeout: REQUEST_TIMEOUT_S,
      [client.customFetch]: idpFetch(config),
    }
  )
}

let configuration: Promise<client.Configuration> | null = null

/** Discovered once per process; a failed discovery is retried by the next request. */
function oidcConfiguration(config: AuthConfig) {
  configuration ??= discover(config).catch((error) => {
    console.error(new Error(error instanceof Error ? error.name : "OIDC failure"))
    configuration = null
    throw new Error("OIDC discovery unavailable")
  })
  return configuration
}

export function newLoginChecks(): Pick<LoginState, "state" | "nonce" | "codeVerifier"> {
  return { state: client.randomState(), nonce: client.randomNonce(), codeVerifier: client.randomPKCECodeVerifier() }
}

export async function authorizationUrl(
  config: AuthConfig,
  checks: Pick<LoginState, "state" | "nonce" | "codeVerifier">
) {
  return client.buildAuthorizationUrl(await oidcConfiguration(config), {
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    resource: config.backendResource,
    code_challenge: await client.calculatePKCECodeChallenge(checks.codeVerifier),
    code_challenge_method: "S256",
    state: checks.state,
    nonce: checks.nonce,
  })
}

const idTokenClaims = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1).optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  picture: z.string().optional(),
})

type TokenResponse = Awaited<ReturnType<typeof client.refreshTokenGrant>>

function accessTokenExpiresAt(response: TokenResponse, requestedAt: number) {
  const expiresIn = response.expiresIn()
  if (expiresIn === undefined) throw new Error("The IdP returned an access token without expires_in.")
  return requestedAt + expiresIn * 1000
}

/** Exchanges the code (with `resource`) and validates the ID token: signature, `iss`, `aud`, `exp`, `nonce`. */
export async function exchangeCode(
  config: AuthConfig,
  callbackUrl: URL,
  checks: Pick<LoginState, "state" | "nonce" | "codeVerifier">
): Promise<ExchangedLogin> {
  const requestedAt = Date.now()
  const response = await client.authorizationCodeGrant(
    await oidcConfiguration(config),
    callbackUrl,
    {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    },
    { resource: config.backendResource }
  )
  const claims = idTokenClaims.parse(response.claims())
  if (!response.refresh_token || !response.id_token) throw new Error("The IdP did not return a refresh and ID token.")
  return {
    tokens: {
      accessToken: response.access_token,
      accessTokenExpiresAt: accessTokenExpiresAt(response, requestedAt),
      refreshToken: response.refresh_token,
      idToken: response.id_token,
    },
    user: {
      sub: claims.sub,
      name: claims.name ?? "",
      email: claims.email ?? "",
      picture: claims.picture ?? null,
    },
    sid: claims.sid ?? null,
  }
}

/** One refresh-token grant. Only `invalid_grant` ends the session; any other failure is the IdP being unavailable. */
export async function refreshTokens(config: AuthConfig, record: SessionRecord): Promise<RefreshResult> {
  const requestedAt = Date.now()
  try {
    const response = await client.refreshTokenGrant(await oidcConfiguration(config), record.refreshToken, {
      resource: config.backendResource,
    })
    if (response.id_token && idTokenClaims.parse(response.claims()).sub !== record.sub)
      throw new Error("Refreshed ID token subject changed.")
    return {
      status: "refreshed",
      tokens: {
        accessToken: response.access_token,
        accessTokenExpiresAt: accessTokenExpiresAt(response, requestedAt),
        refreshToken: response.refresh_token ?? record.refreshToken,
        idToken: response.id_token ?? record.idToken,
      },
    }
  } catch (error) {
    console.error(new Error(error instanceof Error ? error.name : "OIDC failure"))
    if (error instanceof client.ResponseBodyError && error.error === "invalid_grant") return { status: "rejected" }
    throw new Error("OIDC token endpoint unavailable")
  }
}

export async function revokeRefreshToken(config: AuthConfig, refreshToken: string) {
  await client.tokenRevocation(await oidcConfiguration(config), refreshToken, { token_type_hint: "refresh_token" })
}

/** RP-initiated logout; the IdP redirects back only if `post_logout_redirect_uri` is registered for the client. */
export async function endSessionUrl(config: AuthConfig, idToken: string) {
  return client.buildEndSessionUrl(await oidcConfiguration(config), {
    id_token_hint: idToken,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
  })
}
