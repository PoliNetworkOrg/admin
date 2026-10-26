import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/"))
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context)
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier))
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context)
    return nextResolve(specifier, context)
  },
})
const { nextYear } = await import("../src/features/people/people-format.ts")
void test("census never invents an academic year for an incomplete or unknown profile", () => {
  assert.equal(nextYear(""), null)
  assert.equal(nextYear("unknown"), null)
  assert.equal(nextYear("1st year"), "2nd year")
  assert.equal(nextYear("Graduated"), "Graduated")
})
