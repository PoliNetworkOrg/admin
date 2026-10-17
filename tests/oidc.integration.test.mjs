import assert from "node:assert/strict"
import { generateKeyPairSync, createHash, sign, verify } from "node:crypto"
import { createServer } from "node:http"
import test from "node:test"

import { resolveAuthConfig } from "../src/server/auth-config.ts"
import {
  authorizationUrl,
  exchangeCode,
  refreshTokens,
  revokeRefreshToken,
  endSessionUrl,
} from "../src/server/oidc.server.ts"

void test("OIDC code/PKCE/nonce/signature, refresh, revocation use internal transport with public identity", async () => {
  const idp = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const dashboard = generateKeyPairSync("ed25519")
  const publicJwk = { ...idp.publicKey.export({ format: "jwk" }), kid: "idp", alg: "RS256", use: "sig" }
  const privateJwk = { ...dashboard.privateKey.export({ format: "jwk" }), kid: "dashboard", alg: "EdDSA" }
  const issuer = "https://idp.example/api/auth"
  const requests = []
  let nonce = ""
  let challenge = ""
  function jwt(claims) {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "idp" })).toString("base64url")
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
    const input = `${header}.${payload}`
    return `${input}.${sign("sha256", Buffer.from(input), idp.privateKey).toString("base64url")}`
  }
  const server = createServer(async (req, res) => {
    let body = ""
    for await (const chunk of req) body += chunk
    const parameters = new URLSearchParams(body)
    requests.push({ path: req.url, parameters })
    res.setHeader("content-type", "application/json")
    if (req.url.includes(".well-known")) {
      res.end(
        JSON.stringify({
          issuer,
          authorization_endpoint: issuer + "/oauth2/authorize",
          token_endpoint: issuer + "/oauth2/token",
          jwks_uri: issuer + "/jwks",
          revocation_endpoint: issuer + "/oauth2/revoke",
          end_session_endpoint: issuer + "/oauth2/end-session",
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: ["private_key_jwt"],
          code_challenge_methods_supported: ["S256"],
        })
      )
    } else if (req.url === "/api/auth/jwks") {
      res.end(JSON.stringify({ keys: [publicJwk] }))
    } else if (req.url === "/api/auth/oauth2/token" || req.url === "/api/auth/oauth2/revoke") {
      const assertion = parameters.get("client_assertion")
      const [header, payload, signature] = assertion.split(".")
      assert.equal(JSON.parse(Buffer.from(header, "base64url")).alg, "EdDSA")
      assert.equal(
        JSON.parse(Buffer.from(payload, "base64url")).aud,
        issuer + (req.url.endsWith("revoke") ? "/oauth2/revoke" : "/oauth2/token")
      )
      assert.equal(
        verify(null, Buffer.from(`${header}.${payload}`), dashboard.publicKey, Buffer.from(signature, "base64url")),
        true
      )
      if (req.url.endsWith("revoke")) {
        res.end("{}")
        return
      }
      assert.equal(parameters.get("resource"), "https://backend.internal.polinetwork.org")
      if (parameters.get("grant_type") === "authorization_code") {
        assert.equal(createHash("sha256").update(parameters.get("code_verifier")).digest("base64url"), challenge)
        const now = Math.floor(Date.now() / 1000)
        const claims = {
          iss: issuer,
          aud: "dashboard",
          sub: "person",
          sid: "idp-session",
          iat: now,
          exp: now + 300,
          nonce,
          name: "Person",
        }
        if (parameters.get("code") === "wrong-nonce") claims.nonce = "wrong"
        if (parameters.get("code") === "wrong-issuer") claims.iss = "https://evil.example"
        const idToken = jwt(claims)
        res.end(
          JSON.stringify({
            access_token: "access",
            token_type: "Bearer",
            expires_in: 300,
            refresh_token: "refresh",
            id_token: parameters.get("code") === "bad-signature" ? idToken.slice(0, -8) + "abcdefgh" : idToken,
          })
        )
      } else {
        res.end(
          JSON.stringify({
            access_token: "access-new",
            token_type: "Bearer",
            expires_in: 300,
            refresh_token: "refresh-new",
          })
        )
      }
    } else {
      res.statusCode = 404
      res.end("{}")
    }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const config = resolveAuthConfig(
    {
      APP_URL: "https://admin.example",
      IDP_URL: "https://idp.example",
      IDP_INTERNAL_URL: `http://127.0.0.1:${server.address().port}`,
      OIDC_CLIENT_ID: "dashboard",
      OIDC_CLIENT_PRIVATE_JWK: JSON.stringify(privateJwk),
      REDIS_URL: "redis://127.0.0.1:36479",
      SESSION_SECRET: "test-session-secret-at-least-32-chars",
    },
    "production"
  )
  const checks = {
    state: "test-state",
    nonce: "test-nonce",
    codeVerifier: "verifier-with-at-least-forty-three-characters-here",
  }
  try {
    const url = await authorizationUrl(config, checks)
    assert.equal(url.origin, "https://idp.example")
    assert.equal(url.searchParams.get("resource"), config.backendResource)
    challenge = url.searchParams.get("code_challenge")
    nonce = checks.nonce
    const callback = new URL(config.redirectUri + "?state=test-state&code=valid")
    const login = await exchangeCode(config, callback, checks)
    assert.equal(login.user.sub, "person")
    assert.equal(login.sid, "idp-session")
    assert.equal(login.tokens.refreshToken, "refresh")
    for (const code of ["wrong-nonce", "wrong-issuer", "bad-signature"]) {
      callback.searchParams.set("code", code)
      await assert.rejects(exchangeCode(config, callback, checks))
    }
    const record = { ...login.tokens, ...login.user, sid: login.sid, createdAt: Date.now(), lastSeenAt: Date.now() }
    const refreshed = await refreshTokens(config, record)
    assert.equal(refreshed.tokens.refreshToken, "refresh-new")
    await revokeRefreshToken(config, "refresh-new")
    assert.equal((await endSessionUrl(config, login.tokens.idToken)).origin, "https://idp.example")
    assert.ok(requests.some((request) => request.path === "/api/auth/jwks"))
    assert.ok(requests.some((request) => request.path === "/api/auth/oauth2/revoke"))
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
