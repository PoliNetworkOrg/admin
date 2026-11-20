import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  idsIn,
  lineColumn,
  newNodeId,
  parseDocument,
  parseStructure,
} from "../src/features/regulations/latex-structure.ts"

// The grammar of PoliNetworkOrg/legal docs/grammar.md: capi are environments and nest; numbers are hierarchical.
const SOURCE = String.raw`\regolamento[id=r00001]{Regolamento Fondamentale}
Introduzione.
\articolo[id=a00001]{Scopo}
Testo libero.
\articolo[id=a00002, nuovapagina]{Notifiche}
\begin{commi}
  \comma[id=k00001] Prima.
  \comma[id=k00002] Seconda, ai sensi dell'articolo \rif{a00001} comma \rif{k00001}:
  \begin{lettere}
    \lettera uno;
    \lettera due:
    \begin{lettere}
      \lettera primo;
      \lettera secondo.
    \end{lettere}
  \end{lettere}
  Testo dopo le lettere.
  \comma[id=k00003] Un elenco:
  \begin{elenco}
    \voce una;
    \voce due.
  \end{elenco}
\end{commi}
\begin{capo}[id=c00001]{Un capo}
\articolo[id=a00003]{Nel capo}
Testo.
\begin{capo}[id=c00002]{Capo annidato}
\articolo[id=a00004]{Annidato}
Testo.
\end{capo}
\articolo[id=a00005]{Dopo il capo annidato}
Testo.
\end{capo}
\articolo[id=a00006]{Dopo il capo}
Testo.
\regolamento[id=r00002]{Condotta}
\articolo[id=b00001]{Ambito}
Testo.
`

void test("numbers capi and articoli as siblings in their parent, commi per article and lettere per list", () => {
  const { nodes, problems } = parseStructure(SOURCE)
  assert.deepEqual(problems, [])
  const byId = Object.fromEntries(nodes.filter((node) => node.id).map((node) => [node.id, node]))
  const numbers = Object.fromEntries(Object.entries(byId).map(([id, node]) => [id, node.number]))
  assert.deepEqual(numbers, {
    r00001: "1",
    a00001: "1.1",
    a00002: "1.2",
    k00001: "1",
    k00002: "2",
    k00003: "3",
    c00001: "1.3",
    a00003: "1.3.1",
    c00002: "1.3.2",
    a00004: "1.3.2.1",
    a00005: "1.3.3",
    a00006: "1.4",
    r00002: "2",
    b00001: "2.1",
  })
  assert.equal(byId.k00002.reference, "Articolo 1.2, comma 2")
  assert.equal(byId.a00004.path, "Regolamento Fondamentale › Capo 1.3 › Capo 1.3.2 › Articolo 1.3.2.1")
  assert.deepEqual(
    nodes.filter((node) => node.kind === "lettera").map((node) => node.reference),
    [
      "Articolo 1.2, comma 2, lettera (a)",
      "Articolo 1.2, comma 2, lettera (b)",
      "Articolo 1.2, comma 2, lettera (i)",
      "Articolo 1.2, comma 2, lettera (ii)",
    ]
  )
  assert.equal(SOURCE.slice(byId.a00002.idFrom, byId.a00002.idTo), "[id=a00002, nuovapagina]")
  assert.equal(SOURCE.slice(byId.a00001.titleFrom, byId.a00001.titleTo), "Scopo")
  // A capo runs through its \end{capo}; the comma holding the lettere ends at the next comma.
  assert.ok(SOURCE.slice(byId.c00001.from, byId.c00001.to).endsWith("\\end{capo}"))
  assert.ok(SOURCE.slice(byId.k00002.from, byId.k00002.to).trimEnd().endsWith("Testo dopo le lettere."))
  assert.ok(!SOURCE.slice(byId.a00005.from, byId.a00005.to).includes("\\end{capo}"))
})

void test("reports what the grammar refuses without throwing", () => {
  const broken = String.raw`\articolo[id=a00001]{Fuori}
\regolamento[id=r00001]{R}
\articolo{Senza id}
\articolo[id=a00001]{Doppio}
\articolo[id=A_bad]{Id strano}
\articolo[id=a00002, colore=rosso]{Opzione}
\comma[id=k00001] fuori lista
\begin{capo}[id=c00001]{Capo aperto}
\begin{commi}
\comma[id=k00002] dentro \rif{zzzzzz}
\voce fuori elenco
\articolo[id=a00009]{Titolo aperto
`
  const messages = parseStructure(broken).problems.map((problem) => problem.message)
  for (const expected of [
    "\\articolo fuori da un \\regolamento",
    "\\articolo senza id: lo inserisce il sistema",
    "Id ripetuto: a00001",
    "Id non valido: A_bad",
    "Opzione sconosciuta: colore",
    "\\comma fuori da \\begin{commi}",
    "\\begin{commi} fuori da un \\articolo",
    "\\begin{commi} senza \\end{commi}",
    "\\begin{capo} senza \\end{capo}",
    "\\voce fuori da \\begin{elenco}",
    "\\rif a un id inesistente: zzzzzz",
    "\\articolo senza titolo tra graffe",
  ])
    assert.ok(messages.includes(expected), `${expected} in ${JSON.stringify(messages)}`)
})

void test("ignores commands in comments", () => {
  const { nodes, problems } = parseStructure("% \\articolo{commentato}\n\\regolamento[id=r00001]{R} % \\comma\n")
  assert.equal(nodes.length, 1)
  assert.deepEqual(problems, [])
})

void test("a document follows \\input, numbering across files, and places nodes in their own file", () => {
  const files = {
    "RRI.tex": "\\begin{document}\n\\input{regolamenti/a}\n\\input{regolamenti/b.tex}\n\\end{document}\n",
    "regolamenti/a.tex":
      "\\regolamento[id=r00001]{A}\n\\begin{capo}[id=c00001]{Capo}\n\\articolo[id=a00001]{Uno}\nTesto.\n",
    "regolamenti/b.tex":
      "\\articolo[id=a00002]{Due, ancora nel capo}\nTesto.\n\\end{capo}\n\\regolamento[id=r00002]{B}\n",
  }
  const { nodes, problems } = parseDocument(files, "RRI.tex")
  assert.deepEqual(problems, [])
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]))
  assert.equal(byId.a00002.number, "1.1.2")
  assert.equal(byId.a00002.file, "regolamenti/b.tex")
  assert.equal(files["regolamenti/b.tex"].slice(byId.a00002.titleFrom, byId.a00002.titleTo), "Due, ancora nel capo")
  assert.equal(byId.r00002.number, "2")
  // The capo starts in a.tex and continues in b.tex: in a.tex it runs to the end of the file.
  assert.equal(byId.c00001.file, "regolamenti/a.tex")
  assert.equal(byId.c00001.to, files["regolamenti/a.tex"].length)
})

void test("parses the grammar's own example without problems", async (t) => {
  const legal = process.env.REGULATIONS_DEV_LEGAL_DIR
  if (!legal) {
    t.skip("set REGULATIONS_DEV_LEGAL_DIR to a checkout of PoliNetworkOrg/legal")
    return
  }
  const example = await readFile(`${legal}/shared/esempio/esempio.tex`, "utf8")
  const { nodes, problems } = parseStructure(example)
  assert.deepEqual(problems, [])
  assert.ok(nodes.some((node) => node.kind === "capo" && node.number.split(".").length === 3))
})

void test("new ids are six base36 characters, never one already used", () => {
  const taken = idsIn(SOURCE)
  assert.ok(taken.has("a00002"))
  assert.ok(taken.has("k00002"))
  let calls = 0
  // The first draw collides with r00001 on purpose.
  const sequence = [..."r00001".split("").map((char) => parseInt(char, 36) / 36), ...Array(6).fill(0.5)]
  const id = newNodeId(taken, () => sequence[calls++] + 0.0001)
  assert.match(id, /^[0-9a-z]{6}$/)
  assert.ok(!taken.has(id))
})

void test("line and column are 1-based", () => {
  assert.deepEqual(lineColumn("ab\ncd", 4), { line: 2, column: 2 })
})
