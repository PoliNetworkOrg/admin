import assert from "node:assert/strict"
import test from "node:test"

import { sessionDevice } from "../src/features/account/user-agent.ts"

test("session user agents read as browser on system", () => {
  const cases = [
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      { name: "Chrome on Linux", kind: "desktop" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      { name: "Edge on Windows", kind: "desktop" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
      { name: "Firefox on macOS", kind: "desktop" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      { name: "Safari on iOS", kind: "phone" },
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
      { name: "Chrome on iPadOS", kind: "tablet" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      { name: "Chrome on Android", kind: "phone" },
    ],
    ["curl/8.9.1", { name: "curl/8.9.1", kind: "desktop" }],
    [null, { name: "Unknown device", kind: "desktop" }],
  ]
  for (const [userAgent, expected] of cases) assert.deepEqual(sessionDevice(userAgent), expected)
})
