import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"

async function styledFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) return styledFiles(path)
      return /\.(?:[cm]?tsx?|css)$/.test(entry.name) ? [path] : []
    })
  )
  return files.flat()
}

void test("color mixes use oklab, so neutral grays never pick up a red hue", async () => {
  // Chrome mixes two near-gray colors in oklch with a missing hue, which renders as hue 0 (red).
  const offenders = []
  for (const path of await styledFiles("src")) {
    const source = await readFile(path, "utf8")
    if (/color-mix\(in[ _]oklch/.test(source)) offenders.push(path)
  }
  assert.deepEqual(offenders, [], `Use color-mix(in oklab, …) instead of oklch in: ${offenders.join(", ")}`)
})
