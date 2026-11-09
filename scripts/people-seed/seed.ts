import { execFile } from "node:child_process"
import { readFile, rename, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { parseArgs } from "node:util"

import { createTRPCUntypedClient, httpLink, TRPCClientError } from "@trpc/client"
import * as oidc from "openid-client"
import { SuperJSON } from "superjson"
import { z } from "zod"

import {
  createdSchema,
  personRowSchema,
  type PersonRow,
  teamSummarySchema,
} from "../../src/features/people/people.contract.ts"
import {
  describeStep,
  PENDING,
  planSeed,
  type SeedState,
  seedFileSchema,
  type Step,
  type TeamBindings,
} from "./seed-plan.ts"

/**
 * One-off: seeds People from a reviewed seed file (README.md). Signs in as you, so every change is yours and the
 * backend and Auth check it as if you made it in the dashboard.
 *
 *   node scripts/people-seed/seed.ts <file.json>            plan only, writes <file>.plan.json
 *   node scripts/people-seed/seed.ts <file.json> --apply    creates the records and starts the roles
 *   node scripts/people-seed/seed.ts <file.json> --invite   emails an invite to every row with invite: true
 */

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { apply: { type: "boolean", default: false }, invite: { type: "boolean", default: false } },
})
const path = positionals[0]
if (!path || positionals.length > 1 || (values.apply && values.invite)) {
  console.error("Usage: node scripts/people-seed/seed.ts <file.json> [--apply | --invite]")
  process.exit(2)
}
const statePath = `${path}.state.json`

// The seed file is checked before signing in, so a malformed one fails fast.
const parsed = seedFileSchema.safeParse(JSON.parse(await readFile(path, "utf8")))
if (!parsed.success) {
  console.error(`${path} is not a valid seed file:\n${z.prettifyError(parsed.error)}`)
  process.exit(1)
}
const file = parsed.data

const env = z
  .object({
    IDP_URL: z.url().default("https://auth.polinetwork.org"),
    /** The backend the dashboard talks to, e.g. the production one: no default, so a run never hits the wrong one. */
    BACKEND_URL: z.url(),
    BACKEND_RESOURCE: z.url().default("https://backend.internal.polinetwork.org"),
    SEED_CLIENT_ID: z.string().min(1),
    /** Only for a client registered with a secret; a public client has none. */
    SEED_CLIENT_SECRET: z.string().min(1).optional(),
    SEED_REDIRECT_PORT: z.coerce.number().int().min(1024).max(65535).default(53682),
  })
  .parse(process.env)

const state: SeedState = await readFile(statePath, "utf8").then(
  (text) => z.object({ backend: z.string(), records: z.record(z.string(), z.string()) }).parse(JSON.parse(text)),
  (error: NodeJS.ErrnoException): SeedState => {
    if (error.code === "ENOENT") return { backend: env.BACKEND_URL, records: {} }
    console.error(error)
    throw error
  }
)
if (state.backend !== env.BACKEND_URL) {
  console.error(`${statePath} belongs to ${state.backend}, not ${env.BACKEND_URL}: its record IDs would match the`)
  console.error("wrong people. Use the right BACKEND_URL, or a copy of the seed file for this backend.")
  process.exit(1)
}

/** Replaces the state file in one step, so an interrupted write never leaves it truncated. */
async function saveState() {
  await writeFile(`${statePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`)
  await rename(`${statePath}.tmp`, statePath)
}

// Sign-in: the authorization code flow with PKCE on a loopback redirect, asking for the backend's audience.

type Tokens = { access: string; refresh: string | null; expiresAt: number }

async function signIn(): Promise<{ config: oidc.Configuration; tokens: Tokens }> {
  const issuer = new URL("/api/auth", env.IDP_URL)
  const config = await oidc.discovery(
    issuer,
    env.SEED_CLIENT_ID,
    undefined,
    env.SEED_CLIENT_SECRET ? oidc.ClientSecretBasic(env.SEED_CLIENT_SECRET) : oidc.None(),
    issuer.protocol === "http:" ? { execute: [oidc.allowInsecureRequests] } : undefined
  )
  const redirectUri = `http://127.0.0.1:${env.SEED_REDIRECT_PORT}/callback`
  const checks = {
    pkceCodeVerifier: oidc.randomPKCECodeVerifier(),
    expectedState: oidc.randomState(),
    expectedNonce: oidc.randomNonce(),
  }
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope: "openid offline_access backend:admin",
    prompt: "consent",
    resource: env.BACKEND_RESOURCE,
    code_challenge: await oidc.calculatePKCECodeChallenge(checks.pkceCodeVerifier),
    code_challenge_method: "S256",
    state: checks.expectedState,
    nonce: checks.expectedNonce,
  })

  const callback = await new Promise<URL>((resolve, reject) => {
    const server = createServer((request, response) => {
      const received = new URL(request.url ?? "/", redirectUri)
      if (received.pathname !== "/callback") {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Signed in. Close this tab.")
      server.close()
      resolve(received)
    })
    server.on("error", reject)
    server.listen(env.SEED_REDIRECT_PORT, "127.0.0.1", () => {
      console.log(`Sign in to continue: ${url.href}`)
      execFile("open", [url.href], (error) => {
        if (error) console.error(error)
      })
    })
  })

  const requestedAt = Date.now()
  const response = await oidc.authorizationCodeGrant(
    config,
    callback,
    { ...checks, idTokenExpected: true },
    { resource: env.BACKEND_RESOURCE }
  )
  const claims = z.object({ sub: z.string(), email: z.string().optional() }).parse(response.claims())
  console.log(`Signed in as ${claims.email ?? claims.sub}.`)
  return { config, tokens: toTokens(response, requestedAt, null) }
}

function toTokens(
  response: Awaited<ReturnType<typeof oidc.refreshTokenGrant>>,
  requestedAt: number,
  previousRefresh: string | null
): Tokens {
  return {
    access: response.access_token,
    refresh: response.refresh_token ?? previousRefresh,
    expiresAt: requestedAt + (response.expiresIn() ?? 300) * 1000,
  }
}

const session = await signIn()

/** Access tokens last five minutes: refresh one that has less than a minute left. */
async function accessToken() {
  if (session.tokens.expiresAt - Date.now() > 60_000) return session.tokens.access
  if (!session.tokens.refresh) throw new Error("The access token expired and there is no refresh token. Run again.")
  const requestedAt = Date.now()
  const response = await oidc.refreshTokenGrant(session.config, session.tokens.refresh, {
    resource: env.BACKEND_RESOURCE,
  })
  session.tokens = toTokens(response, requestedAt, session.tokens.refresh)
  return session.tokens.access
}

const backend = createTRPCUntypedClient({
  links: [
    httpLink({
      url: `${env.BACKEND_URL}/api/trpc`,
      headers: async () => ({ authorization: `Bearer ${await accessToken()}` }),
      transformer: SuperJSON,
    }),
  ],
})

async function listPeople(): Promise<PersonRow[]> {
  return personRowSchema.array().parse(await backend.query("people.persons.list"))
}

// The run.

/** Only fetched when the file asks for teams. */
async function teamBindings(): Promise<TeamBindings> {
  if (!file.people.some((entry) => entry.teams.length)) return {}
  const teams = teamSummarySchema.array().parse(await backend.query("people.teams.list"))
  return Object.fromEntries(teams.map((team) => [team.id, team.assignable]))
}

const existing = await listPeople()
const plan = planSeed(file, existing, state.records, await teamBindings())

if (values.invite) await sendInvites()
else if (values.apply) await apply()
else await writePlan()

async function writePlan() {
  await writeFile(`${path}.plan.json`, `${JSON.stringify(plan, null, 2)}\n`)
  const created = plan.steps.filter((step) => step.kind === "create").length
  console.log(
    `${file.people.length} rows: ${plan.matches.length - created} match existing records, ${created} new; ` +
      `${plan.steps.length} calls planned.`
  )
  for (const warning of plan.warnings) console.log(`warning: ${warning}`)
  for (const problem of plan.problems) console.log(`problem: ${problem}`)
  console.log(plan.problems.length ? "Fix the problems before --apply." : "No problems: ready for --apply.")
  console.log(`Plan written to ${path}.plan.json`)
}

async function apply() {
  if (plan.problems.length) {
    for (const problem of plan.problems) console.error(`problem: ${problem}`)
    console.error("Nothing written: fix the problems first (run without --apply to see the plan).")
    process.exit(1)
  }
  const ids = new Map(plan.matches.flatMap((match) => (match.id ? [[match.key, match.id] as const] : [])))
  const failed = new Set<string>()
  const results: { key: string; step: string; ok: boolean; error?: string }[] = []

  for (const step of plan.steps) {
    const personId = ids.get(step.key)
    if (step.kind !== "create" && !personId) {
      results.push({ key: step.key, step: describeStep(step), ok: false, error: "skipped: the record wasn't created" })
      continue
    }
    try {
      await run(step, personId ?? "", ids)
      results.push({ key: step.key, step: describeStep(step), ok: true })
    } catch (error) {
      console.error(error)
      failed.add(step.key)
      const message = error instanceof Error ? error.message : String(error)
      results.push({ key: step.key, step: describeStep(step), ok: false, error: message })
    }
    console.log(`${results.at(-1)?.ok ? "ok    " : "FAILED"} ${step.key}: ${describeStep(step)}`)
  }

  await writeFile(`${path}.report.json`, `${JSON.stringify(results, null, 2)}\n`)
  const failures = results.filter((result) => !result.ok).length
  console.log(`${results.length - failures} calls succeeded, ${failures} failed. Report: ${path}.report.json`)
  if (failures) {
    console.log("The run can be repeated: what succeeded is skipped.")
    process.exit(1)
  }
}

async function run(step: Step, personId: string, ids: Map<string, string>) {
  switch (step.kind) {
    case "create": {
      // Marked before the call: if no answer comes back, the next plan asks a person whether the record exists.
      state.records[step.key] = PENDING
      await saveState()
      try {
        const { id } = createdSchema.parse(await backend.mutation("people.persons.create", step.input))
        ids.set(step.key, id)
        state.records[step.key] = id
      } catch (error) {
        // The backend answered with an error, so nothing was created and the next run may try again.
        if (error instanceof TRPCClientError && error.data) delete state.records[step.key]
        throw error
      } finally {
        await saveState()
      }
      return
    }
    case "admin":
      await backend.mutation("people.admins.assign", { personId, since: step.since, capoId: null })
      return
    case "capo":
      await backend.mutation("people.capos.appoint", { personId, since: step.since, scope: step.scope })
      return
    case "capoRef": {
      const capoId = "id" in step.capo ? step.capo.id : ids.get(step.capo.key)
      if (!capoId) throw new Error(`The Capo Admin's record (${"key" in step.capo ? step.capo.key : ""}) is missing.`)
      await backend.mutation("people.admins.setCapoOfReference", { personId, capoId })
      return
    }
    case "team":
      await backend.mutation("people.teams.addMember", {
        teamId: step.team,
        personId,
        role: step.role,
        since: step.since,
        fields: {},
      })
      return
  }
}

async function sendInvites() {
  if (plan.problems.length) {
    for (const problem of plan.problems) console.error(`problem: ${problem}`)
    console.error("No invites sent: fix the problems first (run without --invite to see the plan).")
    process.exit(1)
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date())
  const byId = new Map(existing.map((row) => [row.id, row]))
  let sent = 0
  let failures = 0
  for (const entry of file.people) {
    if (!entry.invite) continue
    const id = plan.matches.find((match) => match.key === entry.key)?.id
    const row = id ? byId.get(id) : undefined
    const skip = !row
      ? "no record yet: run --apply first"
      : row.account.status === "linked"
        ? "already linked"
        : row.account.status === "invite" && row.account.expiresOn >= today
          ? `invite already open until ${row.account.expiresOn}`
          : !row.contactEmail
            ? "no contact email"
            : null
    if (skip) {
      console.log(`skip   ${entry.key}: ${skip}`)
      continue
    }
    try {
      await backend.mutation("people.linking.sendInvite", { personId: id })
      sent++
      console.log(`sent   ${entry.key}${row?.account.status === "invite" ? " (its invite had expired)" : ""}`)
    } catch (error) {
      console.error(error)
      failures++
      console.log(`FAILED ${entry.key}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log(`${sent} invites sent, ${failures} failed.`)
  if (failures) process.exit(1)
}
