import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"

import ts from "typescript"

import {
  associationLinksInput,
  associationSaveErrorMessage,
  parseCreateAssociationForm,
} from "../src/features/associations/associations.validation.ts"
import { isValidLabelSegment } from "../src/features/group-labels/label-tree.ts"
import { parseGuideForm } from "../src/features/guides/guides.validation.ts"
import { parseProjectForm, projectSaveErrorMessage } from "../src/features/projects/projects.validation.ts"
import { isValidWhatsappInviteLink } from "../src/features/whatsapp/whatsapp.validation.ts"
import { isAgentModeEnabled } from "../src/server/permissions.ts"
import { resolveBackendUrl } from "../src/server/runtime-env.ts"

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.[cm]?tsx?$/.test(entry.name) ? [path] : []
    })
  )
  return files.flat()
}

function referencesSymbol(node, symbol, checker) {
  let found = false

  function visit(current) {
    if (ts.isIdentifier(current) && checker.getSymbolAtLocation(current) === symbol) {
      found = true
      return
    }
    if (!found) ts.forEachChild(current, visit)
  }

  visit(node)
  return found
}

function handlerLogsError(root, errorParameter, checker) {
  const errorSymbol = checker.getSymbolAtLocation(errorParameter)
  if (!errorSymbol) return false

  let found = false

  function visit(node) {
    if (node !== root && (ts.isFunctionLike(node) || ts.isCatchClause(node))) return
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "console" &&
      node.expression.name.text === "error" &&
      node.arguments.some((argument) => referencesSymbol(argument, errorSymbol, checker))
    ) {
      found = true
      return
    }
    if (!found) ts.forEachChild(node, visit)
  }

  visit(root)
  return found
}

function exportedServerFunctions(source, file) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const serverFunctions = []

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const isExported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue

      const chain = []
      let expression = declaration.initializer
      while (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
        chain.push({ name: expression.expression.name.text, arguments: expression.arguments })
        expression = expression.expression.expression
      }

      if (
        !ts.isCallExpression(expression) ||
        !ts.isIdentifier(expression.expression) ||
        expression.expression.text !== "createServerFn"
      ) {
        continue
      }

      const method = expression.arguments[0]
      const isPost =
        method &&
        ts.isObjectLiteralExpression(method) &&
        method.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "method" &&
            ts.isStringLiteral(property.initializer) &&
            property.initializer.text === "POST"
        )
      const middleware = chain
        .filter((call) => call.name === "middleware")
        .flatMap((call) => {
          const argument = call.arguments[0]
          return argument && ts.isArrayLiteralExpression(argument)
            ? argument.elements.filter(ts.isIdentifier).map((element) => element.text)
            : []
        })

      serverFunctions.push({ name: declaration.name.text, isExported, isPost, middleware })
    }
  }

  return serverFunctions
}

test("agent mode is limited to development", () => {
  assert.equal(isAgentModeEnabled("development", true), true)
  assert.equal(isAgentModeEnabled("test", true), false)
  assert.equal(isAgentModeEnabled("production", true), false)
  assert.equal(isAgentModeEnabled("development", false), false)
})

test("the backend URL only falls back during development or compilation", () => {
  assert.equal(resolveBackendUrl("https://backend.example", "production", "start"), "https://backend.example")
  assert.equal(resolveBackendUrl(undefined, "development", "dev"), "http://localhost:3000")
  assert.equal(resolveBackendUrl(undefined, "production", "build"), "http://build.invalid")
  assert.equal(resolveBackendUrl(undefined, "production", "start"), undefined)
  assert.equal(resolveBackendUrl(undefined, undefined, undefined), undefined)
})

test("group label paths reject URL separators", async () => {
  assert.equal(isValidLabelSegment("machine/learning"), false)
  assert.equal(isValidLabelSegment("machine?learning"), false)
  assert.equal(isValidLabelSegment("machine-learning"), true)
  const validationSource = await readFile(
    new URL("../src/features/group-labels/group-labels.validation.ts", import.meta.url),
    "utf8"
  )
  assert.match(validationSource, /segments\.some\(\(segment\) => !isValidLabelSegment\(segment\)\)/)
})

test("WhatsApp group links require a real HTTPS invite code", () => {
  assert.equal(isValidWhatsappInviteLink("https://chat.whatsapp.com/AbCdEf123456"), true)
  assert.equal(isValidWhatsappInviteLink("https://chat.whatsapp.com/AbCdEf123456?mode=ems_copy_t"), true)
  assert.equal(isValidWhatsappInviteLink("https://chat.whatsapp.com/"), false)
  assert.equal(isValidWhatsappInviteLink("https://chat.whatsapp.com/two/segments"), false)
  assert.equal(isValidWhatsappInviteLink("http://chat.whatsapp.com/AbCdEf123456"), false)
  assert.equal(isValidWhatsappInviteLink("https://example.com/AbCdEf123456"), false)
  assert.equal(isValidWhatsappInviteLink("not a URL"), false)
})

test("dashboard server functions attach their scoped authorization middleware", async () => {
  const adminFunctionFiles = [
    "src/features/dashboard/overview.functions.ts",
    "src/features/associations/associations.functions.ts",
    "src/features/azure/azure.functions.ts",
    "src/features/azure/groups.functions.ts",
    "src/features/guides/guides.functions.ts",
    "src/features/projects/projects.functions.ts",
    "src/features/group-labels/group-labels.functions.ts",
    "src/features/faqs/faqs.functions.ts",
    "src/features/telegram/grants.functions.ts",
    "src/features/telegram/groups.functions.ts",
    "src/features/telegram/users.functions.ts",
    "src/features/whatsapp/groups.functions.ts",
  ]

  for (const file of adminFunctionFiles) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
    const serverFunctions = exportedServerFunctions(source, file)
    assert.ok(serverFunctions.length > 0, `${file} must export server functions`)
    for (const serverFunction of serverFunctions) {
      assert.ok(serverFunction.isExported, `${file}:${serverFunction.name} must be exported`)
      assert.ok(
        serverFunction.middleware.includes("adminMiddleware") ||
          serverFunction.middleware.some((name) => /(?:Read|Write|Manage|Create)Middleware$/.test(name)),
        `${file}:${serverFunction.name} must authorize access`
      )
    }
  }
})

test("dashboard mutations enforce their exact write scope", async () => {
  const entries = [
    ["azureMembersCreateMiddleware", ["src/features/azure/azure.functions.ts"]],
    ["azureGroupsWriteMiddleware", ["src/features/azure/groups.functions.ts"]],
    ["grantsWriteMiddleware", ["src/features/telegram/grants.functions.ts"]],
    ["telegramGroupsWriteMiddleware", ["src/features/telegram/groups.functions.ts"]],
    ["whatsappGroupsWriteMiddleware", ["src/features/whatsapp/groups.functions.ts"]],
    ["labelsWriteMiddleware", ["src/features/group-labels/group-labels.functions.ts"]],
    [
      "webContentWriteMiddleware",
      [
        "src/features/associations/associations.functions.ts",
        "src/features/guides/guides.functions.ts",
        "src/features/projects/projects.functions.ts",
        "src/features/faqs/faqs.functions.ts",
      ],
    ],
    ["reportsManageMiddleware", ["src/features/group-link-reports/reports.functions.ts"]],
  ].map(([expectedMiddleware, files]) => ({ expectedMiddleware, files }))

  for (const { expectedMiddleware, files } of entries) {
    for (const file of files) {
      const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
      const mutations = exportedServerFunctions(source, file).filter((serverFunction) => serverFunction.isPost)
      assert.ok(mutations.length > 0, `${file} must export at least one mutation`)
      for (const mutation of mutations) {
        assert.deepEqual(
          mutation.middleware,
          [expectedMiddleware],
          `${file}:${mutation.name} must use its dedicated middleware`
        )
      }
    }
  }
})

test("dashboard mutation controls use their server's write scope", async () => {
  const scopes = {
    "src/features/azure/groups-page.tsx": "azure:groups:write",
    "src/features/azure/members-page.tsx": "azure:members:create",
    "src/features/telegram/grants-page.tsx": "tg:grants:manage",
    "src/features/telegram/user-detail/profile.tsx": "tg:grants:manage",
    "src/features/telegram/groups-page.tsx": ["tg:groups:manage", "groups:labels:write"],
    "src/features/whatsapp/whatsapp-groups-page.tsx": ["wa:groups:manage", "groups:labels:write"],
    "src/features/associations/associations-page.tsx": "web:content:write",
    "src/features/faqs/faqs-page.tsx": "web:content:write",
    "src/features/group-labels/group-labels-page.tsx": "groups:labels:write",
    "src/features/groups-by-label/categories-page.tsx": "groups:labels:write",
    "src/features/groups-by-label/category-page.tsx": "groups:labels:write",
    "src/features/groups-by-label/tag-groups-page.tsx": ["groups:labels:write", "tg:groups:manage", "wa:groups:manage"],
    "src/features/groups/group-row-actions.tsx": ["groups:labels:write", "tg:groups:manage", "wa:groups:manage"],
    "src/features/groups-by-label/combined-groups-table.tsx": ["tg:groups:manage", "wa:groups:manage"],
    "src/features/groups-by-label/add-group-to-label-dialog.tsx": "wa:groups:manage",
    "src/features/group-link-reports/reports-page.tsx": "web:reports:manage",
    "src/features/guides/guides-page.tsx": "web:content:write",
    "src/features/projects/projects-page.tsx": "web:content:write",
  }
  const directory = new URL("../src", import.meta.url).pathname
  const checked = new Set()
  for (const file of await sourceFiles(directory)) {
    const relativeFile = file.replace(`${directory}/`, "src/")
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true)
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useCan") {
        assert.ok(Object.hasOwn(scopes, relativeFile), `${relativeFile} needs a write-scope entry`)
        const expected = scopes[relativeFile]
        assert.equal(node.arguments.length, expected === undefined ? 0 : 1, relativeFile)
        if (expected !== undefined) {
          assert.ok(ts.isStringLiteral(node.arguments[0]), `${relativeFile} must declare its write scope`)
          assert.ok([expected].flat().includes(node.arguments[0].text), relativeFile)
        }
        checked.add(relativeFile)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  const compare = (a, b) => a.localeCompare(b)
  assert.deepEqual([...checked].sort(compare), Object.keys(scopes).sort(compare))
})

test("session middleware marks identity-dependent responses private", async () => {
  const source = await readFile(new URL("../src/server/auth.middleware.ts", import.meta.url), "utf8")
  assert.match(source, /setResponseHeader\("Cache-Control", "private, no-store"\)/)
  assert.match(source, /setResponseHeader\("Vary", "Cookie"\)/)
  assert.match(source, /if \(!hasPermission\(permissions, permission\)\) throw new Error\("UNAUTHORIZED"\)/)
  assert.doesNotMatch(source, /new Error\("TELEGRAM_NOT_LINKED"\)/)
})

test("event handlers integrate protected server-function redirects with the router", async () => {
  const consumers = {
    "src/components/telegram/create-grant-dialog.tsx": ["createTelegramGrant", "findTelegramUser"],
    "src/features/associations/associations-page.tsx": ["createAssociation", "editAssociation", "deleteAssociation"],
    "src/features/associations/association-links-dialog.tsx": ["editAssociationLinks"],
    "src/features/azure/member-dialog.tsx": ["createAzureMember"],
    "src/features/azure/membership-dialog.tsx": ["addAzureGroupMember", "removeAzureGroupMember"],
    "src/features/faqs/faqs-page.tsx": ["addFAQ", "editFAQ", "deleteFAQ", "deleteFAQCategory"],
    "src/features/faqs/faq-category-dialog.tsx": ["addFAQCategory", "editFAQCategory"],
    "src/features/group-labels/add-category-dialog.tsx": ["createGroupLabel"],
    "src/features/group-labels/add-tag-dialog.tsx": ["createGroupLabel", "createReleaseLabel"],
    "src/features/group-labels/group-labels-dialog.tsx": ["tagGroup", "untagGroup"],
    "src/features/group-labels/group-labels-page.tsx": ["editGroupLabel", "deleteGroupLabel"],
    "src/features/group-labels/rename-label-dialog.tsx": ["renameGroupLabel"],
    "src/features/group-link-reports/reports-page.tsx": ["resolveGroupLinkReport", "dismissGroupLinkReport"],
    "src/features/groups/group-row-actions.tsx": ["setGroupVisibility", "setWhatsappGroupVisibility"],
    "src/features/groups-by-label/add-child-label-dialog.tsx": ["createGroupLabel"],
    "src/features/groups-by-label/add-group-to-label-dialog.tsx": [
      "createGroupLabel",
      "createWhatsappGroup",
      "tagGroup",
    ],
    "src/features/groups-by-label/publish-tag-groups-dialog.tsx": [
      "setGroupVisibility",
      "setWhatsappGroupVisibility",
      "untagGroup",
    ],
    "src/features/guides/guide-dialogs.tsx": ["createGuide"],
    "src/features/guides/guides-page.tsx": ["deleteGuide"],
    "src/features/projects/projects-page.tsx": ["createProject", "deleteProject", "editProject", "reorderProjects"],
    "src/features/telegram/leave-group-dialog.tsx": ["leaveTelegramGroup"],
    "src/features/telegram/user-detail/grant-dialogs.tsx": ["interruptTelegramGrant"],
    "src/features/whatsapp/delete-group-dialog.tsx": ["deleteWhatsappGroup"],
    "src/features/whatsapp/whatsapp-group-dialog.tsx": ["createWhatsappGroup", "editWhatsappGroup"],
  }

  for (const [file, serverFunctions] of Object.entries(consumers)) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
    for (const serverFunction of serverFunctions) {
      assert.match(source, new RegExp(`useServerFn\\(${serverFunction}\\)`), `${file} must wrap ${serverFunction}`)
    }
  }

  const srcDirectory = new URL("../src", import.meta.url).pathname
  const wrapped = new Set(Object.values(consumers).flat())
  for (const file of (await sourceFiles(srcDirectory)).filter((path) => path.endsWith(".functions.ts"))) {
    const source = await readFile(file, "utf8")
    for (const mutation of exportedServerFunctions(source, file).filter((serverFunction) => serverFunction.isPost)) {
      assert.ok(
        wrapped.has(mutation.name),
        `${file.replace(`${srcDirectory}/`, "src/")}:${mutation.name} needs a useServerFn consumer entry`
      )
    }
  }
})

test("the backend adapter cannot cache request headers at module scope", async () => {
  const source = await readFile(new URL("../src/server/backend.server.ts", import.meta.url), "utf8")
  assert.match(source, /createBackendClient\(accessToken: string \| null\)/)
  assert.doesNotMatch(source, /getRequestHeaders|getRequestHeader/)
  assert.doesNotMatch(source, /const\s+\w*backend\w*\s*=\s*createBackendClient/i)
})

test("guide validation accepts only strict dated PDF uploads", () => {
  const valid = new FormData()
  valid.set("version", " 2.0 ")
  valid.set("date", "2026-08-18T00:00:00.000Z")
  valid.set("file", new File([new Uint8Array(8)], "guide.pdf", { type: "application/pdf" }))
  assert.equal(parseGuideForm(valid).version, "2.0")

  const invalidDate = new FormData()
  invalidDate.set("version", "2.0")
  invalidDate.set("date", "1")
  invalidDate.set("file", new File([new Uint8Array(8)], "guide.pdf", { type: "application/pdf" }))
  assert.throws(() => parseGuideForm(invalidDate), /INVALID_DATE/)

  const wrongType = new FormData()
  wrongType.set("version", "2.0")
  wrongType.set("date", "2026-08-18T00:00:00.000Z")
  wrongType.set("file", new File([new Uint8Array(8)], "guide.txt", { type: "text/plain" }))
  assert.throws(() => parseGuideForm(wrongType), /INVALID_FILE_TYPE/)
})

test("project validation accepts safe fields and supported logos", () => {
  function validProjectForm() {
    const data = new FormData()
    data.set("title", " Project Atlas ")
    data.set("descriptionIt", "Descrizione")
    data.set("descriptionEn", "Description")
    data.set("link", "https://example.com/project")
    data.set("category", "general")
    data.set("logoFile", new File([new Uint8Array(8)], "logo.png", { type: "image/png" }))
    return data
  }

  const valid = validProjectForm()
  assert.equal(parseProjectForm(valid).title, "Project Atlas")

  const invalidLink = validProjectForm()
  invalidLink.set("link", "javascript:alert(1)")
  assert.throws(() => parseProjectForm(invalidLink), /INVALID_LINK/)

  const wrongType = validProjectForm()
  wrongType.set("logoFile", new File([new Uint8Array(8)], "logo.gif", { type: "image/gif" }))
  assert.throws(() => parseProjectForm(wrongType), /INVALID_LOGO_TYPE/)

  const oversized = validProjectForm()
  oversized.set("logoFile", new File([new Uint8Array(1024 * 1024 + 1)], "logo.png", { type: "image/png" }))
  assert.throws(() => parseProjectForm(oversized), /LOGO_TOO_LARGE/)
})

test("association validation accepts bounded image uploads and strict public links", () => {
  const valid = new FormData()
  valid.set("name", " Test association ")
  valid.set("descriptionIt", "Descrizione")
  valid.set("descriptionEn", "Description")
  valid.set("logo", new File(["<svg />"], "logo.svg", { type: "image/svg+xml" }))
  assert.equal(parseCreateAssociationForm(valid).name, "Test association")

  const wrongType = new FormData()
  wrongType.set("name", "Test association")
  wrongType.set("descriptionIt", "Descrizione")
  wrongType.set("descriptionEn", "Description")
  wrongType.set("logo", new File([new Uint8Array(8)], "logo.gif", { type: "image/gif" }))
  assert.throws(() => parseCreateAssociationForm(wrongType), /INVALID_LOGO_TYPE/)

  const oversized = new FormData()
  oversized.set("name", "Test association")
  oversized.set("descriptionIt", "Descrizione")
  oversized.set("descriptionEn", "Description")
  oversized.set("logo", new File([new Uint8Array(1024 * 1024 + 1)], "logo.png", { type: "image/png" }))
  assert.throws(() => parseCreateAssociationForm(oversized), /LOGO_TOO_LARGE/)

  const validLinks = {
    id: 1,
    links: {
      email: "hello@example.org",
      website: "https://example.org",
      facebook: null,
      instagram: null,
      tiktok: null,
      x: null,
      youtube: null,
      telegram: null,
      linkedin: null,
      spotify: null,
    },
  }
  assert.equal(associationLinksInput.parse(validLinks).links.website, "https://example.org")
  assert.throws(
    () => associationLinksInput.parse({ ...validLinks, links: { ...validLinks.links, website: "not a URL" } }),
    /Invalid URL/
  )
})

test("web content save errors explain actionable validation failures", () => {
  assert.equal(projectSaveErrorMessage(new Error("INVALID_LINK")), "Enter a valid HTTP or HTTPS project URL.")
  assert.equal(projectSaveErrorMessage("INVALID_LINK"), "Enter a valid HTTP or HTTPS project URL.")
  assert.equal(
    projectSaveErrorMessage({ error: { message: "INVALID_LINK" } }),
    "Enter a valid HTTP or HTTPS project URL."
  )
  assert.equal(
    projectSaveErrorMessage(new Error("NOT_INVALID_LINKED")),
    "The project could not be saved. Check your permissions and try again."
  )
  assert.equal(projectSaveErrorMessage(new Error("LOGO_TOO_LARGE")), "The logo must be no larger than 1 MB.")
  assert.equal(
    associationSaveErrorMessage(new Error("INVALID_DESCRIPTIONEN")),
    "Enter an English description no longer than 20,000 characters."
  )
  assert.equal(
    associationSaveErrorMessage(new Error("INVALID_LOGO_TYPE")),
    "Choose a JPG, PNG, or SVG logo no larger than 1 MB."
  )
  assert.equal(
    associationSaveErrorMessage(new Error("INVALID_FILE_TYPE")),
    "Choose a JPG, PNG, or SVG logo no larger than 1 MB."
  )
  assert.equal(
    associationSaveErrorMessage({
      message: "Input validation failed",
      data: { zodError: { properties: { logo: { errors: ["Too big: expected value to be <= 1048576"] } } } },
    }),
    "Choose a JPG, PNG, or SVG logo no larger than 1 MB."
  )
})

test("project and association mutations forward FormData to the backend", async () => {
  const [projectsSource, associationsSource] = await Promise.all([
    readFile(new URL("../src/features/projects/projects.functions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/associations/associations.functions.ts", import.meta.url), "utf8"),
  ])

  for (const source of [projectsSource, associationsSource]) {
    assert.match(source, /new FormData\(\)/)
    assert.doesNotMatch(source, /Buffer\.from/)
  }
  assert.match(projectsSource, /addProject\.mutate\(formData/)
  assert.match(projectsSource, /editProject\.mutate\(formData/)
  assert.match(associationsSource, /addAssociation\.mutate\(formData/)
  assert.match(associationsSource, /editAssociation\.mutate\(formData/)
})

test("every caught runtime error is written to the console", async () => {
  const srcDirectory = new URL("../src", import.meta.url).pathname
  const failures = []
  const files = await sourceFiles(srcDirectory)
  const program = ts.createProgram(files, {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    target: ts.ScriptTarget.Latest,
  })
  const checker = program.getTypeChecker()

  for (const file of files) {
    const sourceFile = program.getSourceFile(file)
    assert.ok(sourceFile, `TypeScript must load ${file}`)

    function visit(node) {
      if (ts.isCatchClause(node)) {
        const errorParameter = node.variableDeclaration?.name
        const logsCaughtError =
          errorParameter && ts.isIdentifier(errorParameter)
            ? handlerLogsError(node.block, errorParameter, checker)
            : false

        if (!logsCaughtError) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          failures.push(`${file.replace(`${srcDirectory}/`, "src/")}:${line + 1}`)
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "catch"
      ) {
        const handler = node.arguments[0]
        const errorParameter =
          handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))
            ? handler.parameters[0]?.name
            : undefined
        const logsCaughtError =
          errorParameter &&
          ts.isIdentifier(errorParameter) &&
          handler &&
          (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))
            ? handlerLogsError(handler.body, errorParameter, checker)
            : false

        if (!logsCaughtError) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          failures.push(`${file.replace(`${srcDirectory}/`, "src/")}:${line + 1}`)
        }
      }
      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  assert.deepEqual(failures, [], `Caught errors must be logged at: ${failures.join(", ")}`)
})

void test("the Azure directory read has its own permission boundary", async () => {
  const source = await readFile(new URL("../src/features/azure/azure.functions.ts", import.meta.url), "utf8")
  const read = exportedServerFunctions(source, "azure.functions.ts").find((fn) => fn.name === "getAzureMembers")
  assert.ok(read)
  assert.equal(read.isPost, false)
  assert.deepEqual(read.middleware, ["azureMembersReadMiddleware"])
  const middleware = await readFile(new URL("../src/server/auth.middleware.ts", import.meta.url), "utf8")
  const readMiddleware = middleware.slice(
    middleware.indexOf("export const azureMembersReadMiddleware"),
    middleware.indexOf("export const azureMembersCreateMiddleware")
  )
  assert.match(readMiddleware, /middleware\(\[adminMiddleware\]\)/)
  assert.match(readMiddleware, /requirePermission\(context.permissions, "azure:members:read"\)/)
})
