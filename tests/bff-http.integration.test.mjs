import assert from "node:assert/strict"
import test from "node:test"

/** Run against a local production build configured with a refused local IdP and Redis port; never follows redirects. */
void test(
  "compiled BFF emits 503 for a Redis outage, rejects CSRF, and ignores production agent mode",
  { skip: !process.env.TEST_ADMIN_HTTP_URL },
  async () => {
    const base = new URL(process.env.TEST_ADMIN_HTTP_URL)
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "smoke tests must target a local server")
    const request = (path, options) => fetch(new URL(path, base), { redirect: "manual", ...options })
    assert.equal((await request("/login")).status, 200)
    const dashboard = await request("/dashboard")
    assert.equal(dashboard.status, 307)
    assert.match(dashboard.headers.get("location"), /^\/auth\/login/)
    assert.equal((await request("/auth/callback?state=wrong&code=invalid")).status, 303)
    assert.equal((await request("/auth/login")).status, 503)
    assert.equal((await request("/auth/logout", { method: "POST" })).status, 403)
    assert.equal(
      (await request("/auth/logout", { method: "POST", headers: { origin: "https://evil.example" } })).status,
      403
    )
    assert.equal(
      (await request("/auth/logout", { method: "POST", headers: { origin: process.env.TEST_ADMIN_ORIGIN } })).status,
      303
    )
    const signedOut = await request("/auth/logout", {
      method: "POST",
      headers: { origin: process.env.TEST_ADMIN_ORIGIN, cookie: "__Host-pn-admin-session=opaque-local-test" },
    })
    assert.equal(signedOut.status, 503)
    assert.match(signedOut.headers.get("set-cookie"), /__Host-pn-admin-session=; Path=\/; Max-Age=0/)
    const outage = await request("/dashboard", { headers: { cookie: "__Host-pn-admin-session=opaque-local-test" } })
    assert.equal(outage.status, 503)
    assert.equal(outage.headers.get("cache-control"), "private, no-store")
  }
)
