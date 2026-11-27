import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"

import ts from "@typescript/typescript6"

const root = new URL("../", import.meta.url)
const OPERATION_HELPERS = new Set(["read", "write", "destructive"])

async function sourceFiles(directory, pattern) {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) return sourceFiles(path, pattern)
      return pattern.test(entry.name) ? [path] : []
    })
  )
  return nested.flat()
}

async function parse(path) {
  return ts.createSourceFile(path, await readFile(new URL(path, root), "utf8"), ts.ScriptTarget.Latest, true)
}

/** `export const x = createServerFn(...)...` declarations: method and middleware names. */
function serverFunctions(sourceFile) {
  const found = []
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
      const chain = []
      let expression = declaration.initializer
      while (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
        chain.push(expression)
        expression = expression.expression.expression
      }
      if (
        !ts.isCallExpression(expression) ||
        !ts.isIdentifier(expression.expression) ||
        expression.expression.text !== "createServerFn"
      )
        continue
      const options = expression.arguments[0]
      const post =
        options !== undefined &&
        ts.isObjectLiteralExpression(options) &&
        options.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(sourceFile) === "method" &&
            ts.isStringLiteral(property.initializer) &&
            property.initializer.text === "POST"
        )
      const middleware = chain
        .filter((call) => call.expression.name.text === "middleware")
        .flatMap((call) => {
          const list = call.arguments[0]
          return list && ts.isArrayLiteralExpression(list)
            ? list.elements.filter(ts.isIdentifier).map((element) => element.text)
            : []
        })
      found.push({ name: declaration.name.text, exported, method: post ? "POST" : "GET", middleware })
    }
  }
  return found
}

/** `import { a, b as c } from "@/features/x"`: local name → `src/features/x.ts#a`. */
function imports(sourceFile) {
  const map = new Map()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith("@/")) continue
    const file = `src/${specifier.slice(2)}.ts`
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      map.set(element.name.text, `${file}#${(element.propertyName ?? element.name).text}`)
    }
  }
  return map
}

/** `read|write|destructive("name", serverFunction, { guard: "…" })` calls. */
function operations(sourceFile) {
  const imported = imports(sourceFile)
  const found = []
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      OPERATION_HELPERS.has(node.expression.text) &&
      node.arguments.length === 3
    ) {
      const [name, fn, definition] = node.arguments
      const guard =
        ts.isObjectLiteralExpression(definition) &&
        definition.properties.find(
          (property) => ts.isPropertyAssignment(property) && property.name.getText(sourceFile) === "guard"
        )
      found.push({
        file: sourceFile.fileName,
        kind: node.expression.text,
        definition: definition.getText(sourceFile),
        name: ts.isStringLiteral(name) ? name.text : null,
        serverFunction: ts.isIdentifier(fn) ? (imported.get(fn.text) ?? null) : null,
        guard: guard && ts.isStringLiteral(guard.initializer) ? guard.initializer.text : null,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

/** The keys of `MCP_EXCLUDED` in the registry's index. */
function exclusions(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(sourceFile) !== "MCP_EXCLUDED") continue
      let value = declaration.initializer
      while (value && (ts.isSatisfiesExpression(value) || ts.isAsExpression(value))) value = value.expression
      assert.ok(value && ts.isObjectLiteralExpression(value), "MCP_EXCLUDED must be an object literal")
      return value.properties.map((property) => {
        assert.ok(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name))
        assert.ok(
          ts.isStringLiteral(property.initializer) && property.initializer.text.length > 10,
          `${property.name.text}: give the reason it is left out`
        )
        return property.name.text
      })
    }
  }
  assert.fail("src/mcp/operations/index.ts must export MCP_EXCLUDED")
}

async function registry() {
  const functionFiles = await sourceFiles("src", /\.functions\.ts$/)
  const functions = new Map()
  for (const file of functionFiles) {
    for (const fn of serverFunctions(await parse(file))) functions.set(`${file}#${fn.name}`, { ...fn, file })
  }
  const operationFiles = await sourceFiles("src/mcp/operations", /\.ts$/)
  const registered = (await Promise.all(operationFiles.map(async (file) => operations(await parse(file))))).flat()
  const excluded = exclusions(await parse("src/mcp/operations/index.ts"))
  return { functions, registered, excluded }
}

test("every dashboard server function is an MCP operation or excluded with a reason", async () => {
  const { functions, registered, excluded } = await registry()
  assert.ok(functions.size > 100, "the scan must find the dashboard's server functions")
  const covered = new Set(registered.map((operation) => operation.serverFunction))
  const missing = [...functions.keys()].filter((key) => !covered.has(key) && !excluded.includes(key))
  assert.deepEqual(
    missing,
    [],
    `Add an MCP operation for each of these server functions in src/mcp/operations/<area>.ts (see docs/mcp.md), or list it in MCP_EXCLUDED with the reason:\n${missing.join("\n")}`
  )
  const both = excluded.filter((key) => covered.has(key))
  assert.deepEqual(both, [], "A server function is both an MCP operation and excluded")
  const stale = excluded.filter((key) => !functions.has(key))
  assert.deepEqual(stale, [], "MCP_EXCLUDED names server functions that no longer exist")
})

test("MCP operations name their server function's middleware and an HTTP-compatible kind", async () => {
  const { functions, registered } = await registry()
  const names = new Set()
  for (const operation of registered) {
    const label = `${operation.file}: ${operation.name ?? "(unnamed)"}`
    assert.ok(operation.name, `${label} needs a literal name`)
    assert.match(operation.name, /^[a-z][a-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/, `${label}: use area.resource.action`)
    assert.ok(operation.name.length <= 64, `${label}: keep the name short`)
    assert.ok(!names.has(operation.name), `${label}: duplicate operation name`)
    names.add(operation.name)
    assert.ok(operation.serverFunction, `${label}: pass a server function imported from "@/…"`)
    const fn = functions.get(operation.serverFunction)
    assert.ok(fn, `${label}: ${operation.serverFunction} is not an exported server function`)
    assert.ok(fn.exported, `${label}: export ${operation.serverFunction}`)
    assert.ok(
      operation.guard && fn.middleware.includes(operation.guard),
      `${label}: guard must be ${fn.middleware.join(" or ")}, the server function's middleware`
    )
    if (fn.method === "GET") assert.equal(operation.kind, "read", `${label}: a GET server function is a read`)
  }
})

test("the MCP endpoint reads no cookie and is the only other Origin-check exemption", async () => {
  const { isCsrfExemptPath } = await import("../src/server/csrf.ts")
  assert.equal(isCsrfExemptPath("/api/mcp"), true)
  assert.equal(isCsrfExemptPath("/api/mcp/"), true)
  assert.equal(isCsrfExemptPath("/api/mcp/config"), false)
  assert.equal(isCsrfExemptPath("/api/mcpx"), false)
  for (const file of ["src/mcp/http.server.ts", "src/mcp/server.server.ts", "src/mcp/caller.server.ts"]) {
    const source = await readFile(new URL(file, root), "utf8")
    assert.doesNotMatch(source, /getCookie|readRequestSession|get\("cookie"\)/i, `${file} must not read cookies`)
  }
})

void test("the MCP endpoint resolves the caller before it reads the request body", async () => {
  const source = await readFile(new URL("src/mcp/http.server.ts", root), "utf8")
  const handler = source.slice(source.indexOf("export async function handleMcpRequest"))
  const resolved = handler.indexOf("await resolveCaller(")
  const read = handler.indexOf("await readLimited(request)")
  assert.ok(
    resolved !== -1 && read !== -1 && resolved < read,
    "handleMcpRequest must resolve the caller before reading the body: an unauthenticated request must not make the server buffer and parse up to MCP_MAX_MESSAGE_BYTES"
  )
})

void test("an MCP operation that says it can't be taken back is destructive", async () => {
  const { registered } = await registry()
  const irreversible =
    /can't be (?:undone|reopened|resumed|taken back|made secret again)|not undoable|irreversible|only the Direttivo can change/i
  const wrong = registered.filter(
    (operation) => irreversible.test(operation.definition) && operation.kind !== "destructive"
  )
  assert.deepEqual(
    wrong.map((operation) => operation.name),
    [],
    "Register these with destructive(): their own description says the change can't be taken back, so the agent must ask first"
  )
})
