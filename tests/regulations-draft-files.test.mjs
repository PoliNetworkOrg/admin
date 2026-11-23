import assert from "node:assert/strict"
import test from "node:test"

import {
  allowedPath,
  entryFile,
  fileNameFromTitle,
  inputInsertion,
  inputLinesOf,
  isRegolamento,
  newFileFolders,
  newFilePath,
  starterText,
} from "../src/features/regulations/editor/draft-files.ts"

const RRI_SOURCES = ["RRI.tex", "regolamenti/*.tex"]
const RRI = String.raw`\documentclass{polinetwork-regolamento}
\begin{document}
% inizio dei vari regolamenti di secondo livello

\newpage
\input{./regolamenti/1_fondamentale.tex}

\newpage
\input{./regolamenti/conflitti_di_interesse.tex}

% fine dei vari regolamenti di secondo livello
\end{document}
`

test("new files go only in the folders of the document's globs", () => {
  assert.deepEqual(newFileFolders(RRI_SOURCES), ["regolamenti/"])
  assert.deepEqual(newFileFolders(["*.tex"]), [""])
  assert.deepEqual(newFileFolders(["main.tex", "parti/*.tex", "**/x.tex"]), ["parti/"])
  assert.deepEqual(newFileFolders([]), [""])
  assert.equal(allowedPath("regolamenti/alumni.tex", RRI_SOURCES), true)
  assert.equal(allowedPath("alumni.tex", RRI_SOURCES), false)
  assert.equal(allowedPath("regolamenti/sub/alumni.tex", RRI_SOURCES), false)
  assert.equal(allowedPath("anything/at/all.tex", []), true)
})

test("file names come from the title, like the RRI's", () => {
  assert.equal(fileNameFromTitle("Regolamento Alumni"), "regolamento_alumni")
  assert.equal(fileNameFromTitle("  Attività & Eventi! "), "attivita_eventi")
  assert.equal(newFilePath("regolamenti/", "alumni"), "regolamenti/alumni.tex")
  assert.equal(newFilePath("regolamenti/", "alumni.tex"), "regolamenti/alumni.tex")
})

test("a regolamento's new file starts with its \\regolamento", () => {
  assert.equal(entryFile({ "regolamenti/a.tex": "x", "RRI.tex": RRI }), "RRI.tex")
  assert.equal(isRegolamento(RRI), true)
  assert.equal(starterText(RRI, "Regolamento Alumni"), "\\regolamento{Regolamento Alumni}\n\n")
  assert.equal(starterText("\\documentclass{polinetwork}", "Titolo"), "")
})

test("the \\input goes after the last one, in its style", () => {
  const insertion = inputInsertion(RRI, "regolamenti/alumni.tex")
  assert.ok(insertion)
  const next = RRI.slice(0, insertion.offset) + insertion.text + RRI.slice(insertion.offset)
  assert.match(
    next,
    /\\input\{\.\/regolamenti\/conflitti_di_interesse\.tex\}\n\n\\newpage\n\\input\{\.\/regolamenti\/alumni\.tex\}\n\n% fine/
  )
  const bare = "\\begin{document}\n  \\input{parti/uno}\n\\end{document}\n"
  const other = inputInsertion(bare, "parti/due.tex")
  assert.equal(other?.text, "\n\n  \\input{parti/due}")
  const none = inputInsertion("\\begin{document}\nTesto\n\\end{document}", "a.tex")
  assert.equal(none?.text, "\\input{./a.tex}\n\n")
  assert.equal(inputInsertion("Testo", "a.tex"), null)
})

test("deleting a file removes the lines that include it", () => {
  const ranges = inputLinesOf(RRI, "regolamenti/conflitti_di_interesse.tex")
  assert.equal(ranges.length, 1)
  let text = RRI
  for (const range of ranges) text = text.slice(0, range.from) + text.slice(range.to)
  assert.ok(!text.includes("conflitti_di_interesse"))
  assert.match(text, /1_fondamentale\.tex\}\n\n% fine/)
  // Adding then removing a file gives the main file back as it was.
  const insertion = inputInsertion(RRI, "regolamenti/alumni.tex")
  let added = RRI.slice(0, insertion.offset) + insertion.text + RRI.slice(insertion.offset)
  for (const range of inputLinesOf(added, "regolamenti/alumni.tex"))
    added = added.slice(0, range.from) + added.slice(range.to)
  assert.equal(added, RRI)
  assert.ok(text.includes("\\input{./regolamenti/1_fondamentale.tex}"))
  const inline = inputLinesOf("Vedi \\input{a} qui\n", "a.tex")
  assert.deepEqual(inline, [{ from: 5, to: 14 }])
})
