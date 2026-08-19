import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
import { parseProfilePictureForm } from "../src/features/account/account.validation.ts"
import {
  associationLinksInput,
  associationSaveErrorMessage,
  parseCreateAssociationForm,
} from "../src/features/associations/associations.validation.ts"
import { parseGuideForm } from "../src/features/guides/guides.validation.ts"
import { parseProjectForm, projectSaveErrorMessage } from "../src/features/projects/projects.validation.ts"
import { forwardAuthRequest } from "../src/server/auth-proxy-core.ts"
import { hasAdminRole, isAgentModeEnabled } from "../src/server/authorization.ts"
import { getForwardedCookieHeaders } from "../src/server/request-headers.ts"
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

test("only dashboard administrator roles authorize access", () => {
  assert.equal(hasAdminRole(["owner"]), true)
  assert.equal(hasAdminRole(["direttivo"]), true)
  assert.equal(hasAdminRole(["president"]), true)
  assert.equal(hasAdminRole(["creator"]), false)
  assert.equal(hasAdminRole(["creator", "owner"]), false)
  assert.equal(hasAdminRole([]), false)
})

test("forwarded cookies are derived independently for every request", () => {
  const first = getForwardedCookieHeaders(new Headers({ cookie: "session=first" }))
  const second = getForwardedCookieHeaders(new Headers({ cookie: "session=second" }))
  const anonymous = getForwardedCookieHeaders(new Headers())

  assert.deepEqual(first, { cookie: "session=first" })
  assert.deepEqual(second, { cookie: "session=second" })
  assert.equal(anonymous, undefined)
})

test("the auth proxy preserves the request and exact upstream response", async () => {
  const upstream = new Response("proxied", {
    headers: [
      ["set-cookie", "session=next; Path=/; HttpOnly"],
      ["set-cookie", "csrf=next; Path=/; SameSite=Lax"],
    ],
  })
  let forwarded
  const response = await forwardAuthRequest(
    new Request("https://admin.example/api/auth/callback?provider=passkey", {
      headers: { cookie: "session=current" },
    }),
    "https://backend.example",
    "/api/auth",
    async (request) => {
      forwarded = request
      return upstream
    }
  )

  assert.equal(forwarded.url, "https://backend.example/api/auth/callback?provider=passkey")
  assert.equal(forwarded.headers.get("cookie"), "session=current")
  assert.equal(response, upstream)
  assert.deepEqual(response.headers.getSetCookie(), [
    "session=next; Path=/; HttpOnly",
    "csrf=next; Path=/; SameSite=Lax",
  ])
})

test("admin server functions attach the authorization middleware", async () => {
  const adminFunctionFiles = [
    "src/features/associations/associations.functions.ts",
    "src/features/azure/azure.functions.ts",
    "src/features/guides/guides.functions.ts",
    "src/features/projects/projects.functions.ts",
    "src/features/telegram/grants.functions.ts",
    "src/features/telegram/groups.functions.ts",
    "src/features/telegram/users.functions.ts",
  ]

  for (const file of adminFunctionFiles) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
    const serverFunctionCount = source.match(/createServerFn\(/g)?.length ?? 0
    const adminMiddlewareCount = source.match(/\.middleware\(\[adminMiddleware\]\)/g)?.length ?? 0
    assert.ok(serverFunctionCount > 0, `${file} must export server functions`)
    assert.equal(adminMiddlewareCount, serverFunctionCount, `${file} must authorize every server function`)
  }
})

test("session middleware marks identity-dependent responses private", async () => {
  const source = await readFile(new URL("../src/server/auth.middleware.ts", import.meta.url), "utf8")
  assert.match(source, /setResponseHeader\("Cache-Control", "private, no-store"\)/)
  assert.match(source, /setResponseHeader\("Vary", "Cookie"\)/)
  assert.doesNotMatch(source, /new Error\("(?:UNAUTHORIZED|TELEGRAM_NOT_LINKED)"\)/)
})

test("event handlers integrate protected server-function redirects with the router", async () => {
  const consumers = {
    "src/components/telegram/create-grant-dialog.tsx": ["createTelegramGrant", "findTelegramUser"],
    "src/features/account/use-account.ts": ["uploadProfilePicture"],
    "src/features/associations/association-dialogs.tsx": ["createAssociation", "editAssociation", "deleteAssociation"],
    "src/features/associations/association-links-dialog.tsx": ["editAssociationLinks"],
    "src/features/azure/group-membership.tsx": ["addAzureGroupMember", "removeAzureGroupMember"],
    "src/features/azure/member-dialog.tsx": ["createAzureMember", "setAzureMemberNumber"],
    "src/features/guides/guide-dialogs.tsx": ["createGuide", "deleteGuide"],
    "src/features/projects/projects-page.tsx": ["createProject", "deleteProject", "editProject", "reorderProjects"],
    "src/features/telegram/groups-page.tsx": ["setGroupVisibility"],
    "src/features/telegram/leave-group-dialog.tsx": ["leaveTelegramGroup"],
    "src/features/telegram/user-detail/grant-dialogs.tsx": ["interruptTelegramGrant"],
    "src/features/telegram/user-detail/group-admin-dialog.tsx": ["addTelegramGroupAdmin", "removeTelegramGroupAdmin"],
    "src/features/telegram/user-detail/role-dialog.tsx": ["addTelegramUserRole", "removeTelegramUserRole"],
  }

  for (const [file, serverFunctions] of Object.entries(consumers)) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
    for (const serverFunction of serverFunctions) {
      assert.match(source, new RegExp(`useServerFn\\(${serverFunction}\\)`), `${file} must wrap ${serverFunction}`)
    }
  }
})

test("the backend adapter cannot cache request headers at module scope", async () => {
  const source = await readFile(new URL("../src/server/backend.server.ts", import.meta.url), "utf8")
  assert.match(source, /createBackendClient\(requestHeaders: Headers\)/)
  assert.doesNotMatch(source, /getRequestHeaders|getRequestHeader/)
  assert.doesNotMatch(source, /const\s+\w*backend\w*\s*=\s*createBackendClient/i)
})

test("profile picture validation rejects invalid and oversized files", () => {
  const valid = new FormData()
  valid.set("image", new File([new Uint8Array(8)], "avatar.png", { type: "image/png" }))
  assert.equal(parseProfilePictureForm(valid).name, "avatar.png")

  const wrongType = new FormData()
  wrongType.set("image", new File([new Uint8Array(8)], "avatar.gif", { type: "image/gif" }))
  assert.throws(() => parseProfilePictureForm(wrongType), /INVALID_IMAGE_TYPE/)

  const oversized = new FormData()
  oversized.set("image", new File([new Uint8Array(1024 * 1024 + 1)], "avatar.png", { type: "image/png" }))
  assert.throws(() => parseProfilePictureForm(oversized), /IMAGE_TOO_LARGE/)
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
