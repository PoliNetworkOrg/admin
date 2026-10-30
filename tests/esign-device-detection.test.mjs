import assert from "node:assert/strict"
import test from "node:test"

import { detectOs, isPhoneOrTablet } from "../src/features/esign/signing-device.ts"

const agents = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipadDesktopMode:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
}

void test("phones and tablets can't sign, computers can", () => {
  assert.equal(isPhoneOrTablet(agents.iphone, 5), true)
  assert.equal(isPhoneOrTablet(agents.androidPhone, 5), true)
  assert.equal(isPhoneOrTablet(agents.androidTablet, 10), true)
  // iPadOS Safari asks for the desktop site and reports a Mac: only its touch screen gives it away.
  assert.equal(isPhoneOrTablet(agents.ipadDesktopMode, 5), true)
  assert.equal(isPhoneOrTablet(agents.mac, 0), false)
  assert.equal(isPhoneOrTablet(agents.windows, 0), false)
  assert.equal(isPhoneOrTablet(agents.linux, 0), false)
})

void test("a computer's system picks its setup steps and download", () => {
  assert.equal(detectOs(agents.mac), "macos")
  assert.equal(detectOs(agents.windows), "windows")
  assert.equal(detectOs(agents.linux), "linux")
  assert.notEqual(detectOs(agents.androidTablet), "linux")
})
