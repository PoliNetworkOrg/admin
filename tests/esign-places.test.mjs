import assert from "node:assert/strict"
import test from "node:test"

import { placeAt } from "../src/features/esign/places.ts"

const A4 = { width: 595, height: 842 }
const A4_LANDSCAPE = { width: 842, height: 595 }

void test("a moved place is centred on the click, on the clicked page, with its kind", () => {
  const mark = { kind: "mark", page: 1, x: 0.6, y: 0.8, width: 0.3, height: 0.1 }
  const moved = placeAt(mark, [A4, A4], 0, 0.5, 0.4)
  assert.equal(moved.kind, "mark")
  assert.equal(moved.page, 0)
  assert.ok(Math.abs(moved.width - 0.3) < 1e-9 && Math.abs(moved.height - 0.1) < 1e-9)
  assert.ok(Math.abs(moved.x - 0.35) < 1e-9 && Math.abs(moved.y - 0.35) < 1e-9)
})

void test("a place moved to a page of another size keeps its size in points", () => {
  const place = { kind: "signature", page: 0, x: 0.1, y: 0.1, width: 0.3, height: 0.08 }
  const moved = placeAt(place, [A4, A4_LANDSCAPE], 1, 0.5, 0.5)
  assert.ok(Math.abs(moved.width * A4_LANDSCAPE.width - 0.3 * A4.width) < 1e-9)
  assert.ok(Math.abs(moved.height * A4_LANDSCAPE.height - 0.08 * A4.height) < 1e-9)
})

void test("a click near the edge keeps the whole place on the page", () => {
  const place = { kind: "signature", page: 0, x: 0.1, y: 0.1, width: 0.3, height: 0.08 }
  const corner = placeAt(place, [A4], 0, 0.99, 0.01)
  assert.ok(Math.abs(corner.x - 0.7) < 1e-9)
  assert.equal(corner.y, 0)
})
