import { randomUUID } from "node:crypto"

import type { CatalogueEntry, Contact, Member, Profile, Request } from "./portal.contract"
import { createAssociationService, type Mail, type Record, type Store, type Viewer } from "./portal.fake-service.server"

/**
 * Agent mode's stand-in for the backend's `associationPortal.*` procedures. It runs the backend's own service (copied
 * in `portal.fake-service.server.ts`) over an in-memory store that lives for the dev server's lifetime, so changes show
 * up on reload. `AGENT_ASSOCIATION_ROLE` places the agent-mode user in the sample registry: operator, responsible or
 * collaborator of Associazione Alfa, or an account with no association. Emails are printed to the server log.
 */

type Role = "operator" | "responsible" | "collaborator" | "none"

const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

export const SAMPLE_PROGRAMMES = {
  informatica: "didattica.ingegneria-industriale-informazione.triennale.ingegneria-informatica",
  gestionale: "didattica.ingegneria-industriale-informazione.magistrale.ingegneria-gestionale",
  aerospaziale: "didattica.ingegneria-industriale-informazione.triennale.ingegneria-aerospaziale",
  architettura: "didattica.auic.triennale.progettazione-dell-architettura",
  comunicazione: "didattica.design.triennale.design-della-comunicazione",
  retired: "didattica.design.triennale.design-degli-interni-vecchio",
}

function catalogue(): CatalogueEntry[] {
  const programme = (slug: string, nameIt: string, nameEn: string, active = true): CatalogueEntry => ({
    kind: "programme",
    slug,
    nameIt,
    nameEn,
    active,
  })
  const campus = (slug: string, nameIt: string, nameEn: string): CatalogueEntry => ({
    kind: "campus",
    slug,
    nameIt,
    nameEn,
    active: true,
  })
  return [
    programme(SAMPLE_PROGRAMMES.informatica, "Ingegneria Informatica (triennale)", "Computer Engineering (bachelor)"),
    programme(SAMPLE_PROGRAMMES.gestionale, "Ingegneria Gestionale (magistrale)", "Management Engineering (master)"),
    programme(
      SAMPLE_PROGRAMMES.aerospaziale,
      "Ingegneria Aerospaziale (triennale)",
      "Aerospace Engineering (bachelor)"
    ),
    programme(
      SAMPLE_PROGRAMMES.architettura,
      "Progettazione dell’Architettura (triennale)",
      "Architectural Design (bachelor)"
    ),
    programme(
      SAMPLE_PROGRAMMES.comunicazione,
      "Design della Comunicazione (triennale)",
      "Communication Design (bachelor)"
    ),
    programme(
      SAMPLE_PROGRAMMES.retired,
      "Design degli Interni (ordinamento precedente)",
      "Interior Design (old)",
      false
    ),
    campus("leonardo", "Milano Leonardo", "Milan Leonardo"),
    campus("bovisa", "Milano Bovisa", "Milan Bovisa"),
    campus("cremona", "Cremona", "Cremona"),
    campus("lecco", "Lecco", "Lecco"),
    campus("mantova", "Mantova", "Mantua"),
    campus("piacenza", "Piacenza", "Piacenza"),
  ]
}

function profile(name: string, extra: Partial<Profile> = {}): Profile {
  return {
    name,
    acronym: "",
    descriptionIt: `${name} organizza attività per gli studenti del Politecnico.`,
    descriptionEn: `${name} runs activities for Politecnico students.`,
    logo: null,
    email: `info@${name.toLowerCase().replaceAll(" ", "-")}.example.org`,
    links: [{ platform: "instagram", label: "Instagram", url: "https://instagram.com/example" }],
    programmes: [],
    campuses: [],
    crossProgramme: false,
    contacts: [],
    ...extra,
  }
}

function contact(
  fn: Contact["function"],
  label: string,
  visibility: Contact["visibility"],
  extra: Partial<Contact> = {}
) {
  return {
    id: randomUUID(),
    function: fn,
    label,
    email: `${fn}@example.org`,
    name: "",
    phone: "",
    visibility,
    holderSub: null,
    ...extra,
  } satisfies Contact
}

function request(kind: Request["kind"], by: Member, extra: Partial<Request> = {}): Request {
  return {
    id: randomUUID(),
    redirectId: null,
    kind,
    status: "submitted",
    by: by.sub,
    byName: by.name,
    explanation: "Faccio parte del direttivo dell’associazione.",
    response: "",
    profile: null,
    targetSub: by.sub,
    targetName: by.name,
    targetEmail: "",
    role: "collaborator",
    email: `${by.sub}@example.org`,
    remove: false,
    accepted: true,
    createdAt: days(-2),
    updatedAt: days(-2),
    decidedBy: null,
    ...extra,
  }
}

function record(name: string, members: Member[], extra: Partial<Record> = {}): Record {
  const p = extra.profile ?? profile(name)
  return {
    id: randomUUID(),
    legacyId: null,
    revision: 1,
    creator: members[0]?.sub ?? "system",
    registered: true,
    status: "active",
    profile: p,
    published: p,
    members,
    requests: [],
    events: [
      {
        id: randomUUID(),
        at: days(-30),
        actor: "PoliNetwork",
        action: "Association registered by PoliNetwork",
        detail: "",
      },
    ],
    invitations: [],
    notes: "",
    commands: [],
    contacts: [],
    ...extra,
  }
}

function seed(agent: Viewer, role: Role) {
  const responsible: Member =
    role === "responsible"
      ? { sub: agent.sub, name: agent.name, role: "responsible", active: true }
      : { sub: "sample-responsible", name: "Giulia Bianchi", role: "responsible", active: true }
  const collaborator: Member =
    role === "collaborator"
      ? { sub: agent.sub, name: agent.name, role: "collaborator", active: true }
      : { sub: "sample-collaborator", name: "Marco Verdi", role: "collaborator", active: true }
  const applicant: Member = { sub: "sample-applicant", name: "Sara Neri", role: "collaborator", active: false }
  const alfaProfile = profile("Associazione Alfa", {
    acronym: "ALFA",
    programmes: [SAMPLE_PROGRAMMES.informatica],
    campuses: ["leonardo"],
    contacts: [{ ...contact("presidency", "Presidenza", "public"), visibility: "public" }],
  })
  const alfa = record("Associazione Alfa", [responsible, collaborator], {
    profile: alfaProfile,
    published: alfaProfile,
    contacts: [
      contact("events", "Eventi", "associations", { name: collaborator.name, holderSub: collaborator.sub }),
      contact("presidency", "Presidente", "polinetwork", {
        name: responsible.name,
        phone: "+39 333 000 0000",
        holderSub: responsible.sub,
      }),
    ],
    requests: [request("access", applicant)],
  })
  const betaProfile = profile("Associazione Beta", {
    crossProgramme: true,
    campuses: ["bovisa", "lecco"],
  })
  const beta = record(
    "Associazione Beta",
    [{ sub: "sample-beta", name: "Luca Russo", role: "responsible", active: true }],
    {
      profile: betaProfile,
      published: betaProfile,
      contacts: [
        contact("collaborations", "Collaborazioni", "associations"),
        contact("communications", "Comunicazione interna", "polinetwork"),
      ],
    }
  )
  const gammaProfile = profile("Gruppo Gamma", { programmes: [SAMPLE_PROGRAMMES.architettura], campuses: ["mantova"] })
  const gamma = record("Gruppo Gamma", [], {
    creator: "sample-gamma",
    registered: false,
    status: "pending",
    profile: gammaProfile,
    published: null,
    requests: [
      request(
        "registration",
        { sub: "sample-gamma", name: "Elena Galli", role: "responsible", active: false },
        { profile: gammaProfile, role: "responsible" }
      ),
    ],
  })
  return [alfa, beta, gamma]
}

type State = { rows: Map<string, Record>; catalogue: CatalogueEntry[]; creation: Map<string, string> }
const states = new Map<string, State>()

function stateFor(agent: Viewer, role: Role) {
  const key = `${agent.sub}:${role}`
  let state = states.get(key)
  if (!state) {
    state = {
      rows: new Map(seed(agent, role).map((r) => [r.id, r])),
      catalogue: catalogue(),
      creation: new Map(),
    }
    states.set(key, state)
  }
  return state
}

function memoryStore(state: State): Store {
  const all = () => [...state.rows.values()]
  return {
    list: async () => structuredClone(all()),
    get: async (id) => structuredClone(state.rows.get(id) ?? null),
    byInvitation: async (hash) =>
      structuredClone(all().find((r) => r.invitations.some((i) => i.hash === hash)) ?? null),
    published: async () => structuredClone(all().filter((r) => r.registered && r.published)),
    recentAccessRequests: async (sub, since) =>
      all()
        .flatMap((r) => r.requests)
        .filter((q) => q.by === sub && q.kind === "access" && q.createdAt > since).length,
    async create(r, commandId, actor) {
      const key = `${actor}:${commandId}`
      const existing = state.creation.get(key)
      if (existing) return existing
      state.rows.set(r.id, structuredClone(r))
      state.creation.set(key, r.id)
      return r.id
    },
    // Like the PostgreSQL store, a failed operation leaves the stored record untouched.
    async change(id, operation) {
      const current = state.rows.get(id)
      if (!current) throw new Error("Associazione non trovata")
      const r = structuredClone(current)
      const mail: Mail[] = []
      const result = operation(r, mail)
      state.rows.set(id, r)
      for (const m of mail) console.info(`[agent mode] Email to ${m.to}: ${m.subject}\n${m.text}`)
      return result
    },
    async transfer(from, to, operation) {
      const a = structuredClone(state.rows.get(from))
      const b = structuredClone(state.rows.get(to))
      if (!a || !b) throw new Error("Associazione non trovata")
      const result = operation(a, b)
      state.rows.set(from, a)
      state.rows.set(to, b)
      return result
    },
    catalogue: async () => structuredClone(state.catalogue),
    async saveCatalogue(entry) {
      const index = state.catalogue.findIndex((e) => e.kind === entry.kind && e.slug === entry.slug)
      if (index >= 0) state.catalogue[index] = entry
      else state.catalogue.push(entry)
    },
  }
}

/** The fake API for this agent-mode user, with the same shape as `portalApi`'s backend client. */
export function fakePortalApi(user: { sub: string; name: string; email: string }, role: Role) {
  const viewer: Viewer = { sub: user.sub, name: user.name, email: user.email, operator: role === "operator" }
  const service = createAssociationService(memoryStore(stateFor(viewer, role)), "http://localhost:3000")
  return { viewer, service }
}
