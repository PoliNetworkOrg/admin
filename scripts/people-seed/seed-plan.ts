import { z } from "zod"

import {
  createPersonInputSchema,
  type PersonRow,
  personIdSchema,
  TEAM_ROLES,
  type TeamId,
  teamIdSchema,
  type TeamRole,
} from "../../src/features/people/people.contract.ts"

/**
 * The seed file an agent writes from the census spreadsheets (see AGENT_PROMPT.md), and the plan that turns it into
 * `people.*` calls. Planning is pure: it reads the file, the records People already holds and the previous runs'
 * state, and lists every call, or the problems that stop the run. It never edits or ends anything that exists.
 */

const dateSchema = z.iso.date()

export const seedEntrySchema = createPersonInputSchema.extend({
  /** Stable for this person across runs: their contact email when known, else something like `row:Foglio1:14`. */
  key: z.string().trim().min(1).max(254),
  /** Where the row came from, for review: file, sheet, row. */
  source: z.string().trim().min(1).max(200),
  /** The existing record this row is, when a person decided so. */
  existingId: personIdSchema.nullable().default(null),
  /** A person confirmed this is not the existing record with the same name. */
  newRecord: z.boolean().default(false),
  admin: z.boolean(),
  /** When they became an admin, if the census says so; else the file's `since`. */
  adminSince: dateSchema.nullable().default(null),
  /** Makes them Capo Admin for this scope (they must be an admin). */
  capoScope: z.string().trim().min(1).max(120).nullable().default(null),
  /** The `key` of another row, or a `P-0000` record ID, that is their Capo Admin. */
  capoOfReference: z.string().trim().min(1).nullable().default(null),
  teams: z.array(z.object({ team: teamIdSchema, role: z.enum(TEAM_ROLES) })).default([]),
  /** Send an invite in the `--invite` run. */
  invite: z.boolean().default(true),
})
export type SeedEntry = z.infer<typeof seedEntrySchema>

export const seedFileSchema = z.object({
  /** The start date of every role without its own. */
  since: dateSchema,
  people: z.array(seedEntrySchema).min(1).max(2000),
})
export type SeedFile = z.infer<typeof seedFileSchema>

/**
 * Which record each row became in earlier runs, `key` → `P-0000`, or `pending` while a create's outcome is unknown.
 * The file belongs to one backend: record IDs from another one would match the wrong people.
 */
export type SeedState = { backend: string; records: Record<string, string> }
export const PENDING = "pending"

/** Which roles PoliNetwork Auth binds for each team (`people.teams.list`): an unbound one can't be assigned. */
export type TeamBindings = Partial<Record<TeamId, { member: boolean; lead: boolean }>>

/** Another row of the file (whose record may not exist until its create step runs), or an existing record. */
export type Ref = { key: string } | { id: string }

export type Step =
  | { kind: "create"; key: string; input: z.output<typeof createPersonInputSchema> }
  | { kind: "admin"; key: string; since: string }
  | { kind: "capo"; key: string; since: string; scope: string }
  | { kind: "capoRef"; key: string; capo: Ref }
  | { kind: "team"; key: string; team: TeamId; role: TeamRole; since: string }

export type Match = { key: string; id: string | null; how: "state" | "existingId" | "email" | "new" }

export type Plan = {
  matches: Match[]
  steps: Step[]
  /** Anything here stops `--apply`. */
  problems: string[]
  /** Worth a look, but not blocking. */
  warnings: string[]
}

/** Lowercase, without accents, apostrophes or repeated spaces: for spotting the same name, never for merging. */
export function normalizeName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

const email = (value: string | null) => (value ?? "").trim().toLowerCase()
const fullName = (row: Pick<PersonRow, "firstName" | "lastName">) => `${row.firstName} ${row.lastName}`

function currentOf(row: PersonRow | undefined) {
  const live = (row?.assignments ?? []).filter((a) => a.endedOn === null)
  return {
    admin: live.find((a) => a.kind === "admin") ?? null,
    capo: live.find((a) => a.kind === "capo") ?? null,
    team: (team: TeamId) => live.find((a) => a.kind === "team" && a.team === team) ?? null,
  }
}

export function planSeed(
  file: SeedFile,
  existing: readonly PersonRow[],
  records: SeedState["records"],
  bindings: TeamBindings
): Plan {
  const problems: string[] = []
  const warnings: string[] = []
  const steps: Step[] = []
  const byId = new Map(existing.map((row) => [row.id, row]))
  const label = (entry: SeedEntry) => `${entry.key} (${entry.source})`

  // The file itself: unique keys, emails and names.
  const keys = new Map<string, SeedEntry>()
  const emails = new Map<string, SeedEntry>()
  const names = new Map<string, SeedEntry>()
  for (const entry of file.people) {
    if (keys.has(entry.key)) problems.push(`${label(entry)}: the key is used twice.`)
    keys.set(entry.key, entry)
    const mail = email(entry.contactEmail)
    const other = mail ? emails.get(mail) : undefined
    if (other) problems.push(`${label(entry)}: same contact email as ${label(other)}.`)
    if (mail) emails.set(mail, entry)
    const name = normalizeName(entry.firstName, entry.lastName)
    const twin = names.get(name)
    if (twin && !entry.newRecord)
      problems.push(`${label(entry)}: same name as ${label(twin)}. Merge the rows, or set newRecord if they differ.`)
    names.set(name, entry)
  }

  // Which record each row is.
  const matches: Match[] = []
  const claimed = new Map<string, string>()
  for (const entry of file.people) {
    let match: Match = { key: entry.key, id: null, how: "new" }
    const fromState = records[entry.key]
    const mail = email(entry.contactEmail)
    const sameEmail = mail ? existing.filter((row) => email(row.contactEmail) === mail) : []
    const interrupted = fromState === PENDING
    if (fromState && !interrupted) {
      if (byId.has(fromState)) match = { key: entry.key, id: fromState, how: "state" }
      else problems.push(`${label(entry)}: an earlier run created ${fromState}, which no longer exists.`)
    } else if (entry.existingId) {
      if (byId.has(entry.existingId)) match = { key: entry.key, id: entry.existingId, how: "existingId" }
      else problems.push(`${label(entry)}: existingId ${entry.existingId} doesn't exist.`)
    } else if (sameEmail.length > 1) {
      problems.push(
        `${label(entry)}: ${sameEmail.map((row) => row.id).join(", ")} share this contact email. Set existingId.`
      )
    } else if (sameEmail.length === 1) {
      match = { key: entry.key, id: sameEmail[0].id, how: "email" }
    } else if (interrupted) {
      problems.push(
        `${label(entry)}: an interrupted run may have created this record. Look for it in People and set ` +
          "existingId, or remove the key from the state file if it isn't there."
      )
    } else if (!entry.newRecord) {
      const name = normalizeName(entry.firstName, entry.lastName)
      const sameName = existing.filter((row) => normalizeName(row.firstName, row.lastName) === name)
      if (sameName.length)
        problems.push(
          `${label(entry)}: possibly ${sameName.map((row) => `${row.id} ${fullName(row)}`).join(", ")}. ` +
            "Set existingId, or newRecord if it's someone else."
        )
    }
    if (match.id) {
      const owner = claimed.get(match.id)
      if (owner) problems.push(`${label(entry)}: ${match.id} is already the record of ${owner}.`)
      claimed.set(match.id, entry.key)
      const row = byId.get(match.id)
      if (row && mail && email(row.contactEmail) && email(row.contactEmail) !== mail)
        warnings.push(`${label(entry)}: ${match.id} has another contact email; the script leaves records unchanged.`)
    }
    matches.push(match)
  }
  const matchOf = new Map(matches.map((match) => [match.key, match]))
  const entryOf = new Map(matches.flatMap((match) => (match.id ? [[match.id, keys.get(match.key)] as const] : [])))
  const rowOf = (key: string) => {
    const id = matchOf.get(key)?.id
    return id ? byId.get(id) : undefined
  }

  // Who ends up an admin and a Capo Admin, to check references and the one Lead per team.
  const willBeAdmin = (entry: SeedEntry) => entry.admin || currentOf(rowOf(entry.key)).admin !== null
  const willBeCapo = (entry: SeedEntry) => entry.capoScope !== null || currentOf(rowOf(entry.key)).capo !== null
  /** A reference by key, or by the ID of a record a row is matched to, also counts the row's planned appointment. */
  const willBeCapoRef = (entry: SeedEntry | undefined, target: string) =>
    entry ? willBeCapo(entry) : currentOf(byId.get(target)).capo !== null
  const leads = new Map<TeamId, string>()
  for (const row of existing) {
    for (const a of row.assignments)
      if (a.kind === "team" && a.team && a.teamRole === "lead" && a.endedOn === null) leads.set(a.team, row.id)
  }

  for (const entry of file.people) {
    const match = matchOf.get(entry.key)
    if (!match) continue
    const row = rowOf(entry.key)
    const now = currentOf(row)
    if (!match.id) {
      const { firstName, lastName, contactEmail, phone, telegramUsername } = entry
      steps.push({
        kind: "create",
        key: entry.key,
        input: { firstName, lastName, contactEmail, phone, telegramUsername },
      })
    }
    if (entry.admin && !now.admin) steps.push({ kind: "admin", key: entry.key, since: entry.adminSince ?? file.since })
    if (entry.capoScope !== null) {
      if (!willBeAdmin(entry)) problems.push(`${label(entry)}: a Capo Admin must be an admin too.`)
      else if (!now.capo) steps.push({ kind: "capo", key: entry.key, since: file.since, scope: entry.capoScope })
      else if (now.capo.capoScope !== entry.capoScope)
        warnings.push(`${label(entry)}: already Capo Admin for "${now.capo.capoScope}"; the scope stays.`)
    }
    if (entry.capoOfReference !== null) {
      const target = entry.capoOfReference
      const inFile = keys.get(target)
      const capo: Ref | null = inFile
        ? { key: target }
        : personIdSchema.safeParse(target).success && byId.has(target)
          ? { id: target }
          : null
      const capoId = inFile ? matchOf.get(target)?.id : target
      if (!capo) problems.push(`${label(entry)}: Capo Admin of reference "${target}" is no row key or record ID.`)
      else if (!willBeAdmin(entry)) problems.push(`${label(entry)}: only an admin has a Capo Admin of reference.`)
      else if (target === entry.key || (capoId && capoId === match.id))
        problems.push(`${label(entry)}: can't be their own Capo Admin of reference.`)
      else if (!willBeCapoRef(inFile ?? entryOf.get(target), target))
        problems.push(`${label(entry)}: "${target}" isn't and won't be a Capo Admin.`)
      else if (!capoId || now.admin?.capoOfReference?.id !== capoId) {
        if (now.admin?.capoOfReference)
          warnings.push(`${label(entry)}: Capo Admin of reference changes from ${now.admin.capoOfReference.id}.`)
        steps.push({ kind: "capoRef", key: entry.key, capo })
      }
    }
    const teamsSeen = new Set<TeamId>()
    for (const { team, role } of entry.teams) {
      if (teamsSeen.has(team)) problems.push(`${label(entry)}: team ${team} listed twice.`)
      teamsSeen.add(team)
      const held = now.team(team)
      if (held) {
        if (held.teamRole !== role)
          problems.push(`${label(entry)}: already ${held.teamRole} of ${team}; change it in the dashboard.`)
        continue
      }
      if (!bindings[team]?.[role]) {
        problems.push(`${label(entry)}: PoliNetwork Auth binds no role to ${team} ${role}, so it can't be assigned.`)
        continue
      }
      if (role === "lead") {
        const lead = leads.get(team)
        if (lead && lead !== (match.id ?? entry.key)) problems.push(`${label(entry)}: ${team} already has a Lead.`)
        leads.set(team, match.id ?? entry.key)
      }
      steps.push({ kind: "team", key: entry.key, team, role, since: file.since })
    }
  }

  // Records first, then admins before Capo Admins (who must be admins), then references, then teams.
  const order: Step["kind"][] = ["create", "admin", "capo", "capoRef", "team"]
  steps.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  return { matches, steps, problems, warnings }
}

export function describeStep(step: Step) {
  switch (step.kind) {
    case "create":
      return `create ${step.input.firstName} ${step.input.lastName}`
    case "admin":
      return `make admin from ${step.since}`
    case "capo":
      return `appoint Capo Admin for "${step.scope}" from ${step.since}`
    case "capoRef":
      return `set Capo Admin of reference to ${"id" in step.capo ? step.capo.id : step.capo.key}`
    case "team":
      return `add to ${step.team} as ${step.role} from ${step.since}`
  }
}
