import {
  type Activity,
  type Assignment,
  type CampusId,
  COURSE_LEVELS,
  type Course,
  type RepresentativeRole,
  SCHOOL_IDS,
  TEAM_IDS,
  type TeamId,
} from "./people.contract"

/**
 * Agent mode's sample register. Deterministic, so the same records come back after a dev server restart. It covers
 * every case the pages show: linked and unlinked records, open and expired invites, and assignments in every status
 * (pending until linked, waiting for Auth, applied, refused by Auth with its reason), current and ended.
 */

export type StoredAssignment = Assignment & {
  /** For `sent`: when fake Auth confirms it. `null` keeps it waiting (Auth not answering). */
  settlesAt: number | null
}

export type StoredInvite = {
  email: string
  sentOn: string
  expiresOn: string
  sentBy: string
}

export type StoredPerson = {
  id: string
  firstName: string
  lastName: string
  contactEmail: string | null
  phone: string | null
  telegramUsername: string | null
  notes: string | null
  accountSub: string | null
  linkMethod: "invite" | "manual" | "auth" | null
  linkedOn: string | null
  linkedBy: string | null
  invite: StoredInvite | null
  courseCode: number | null
  campus: CampusId | null
  otherAssociations: string[]
  representativeRoles: RepresentativeRole[]
  representativeOther: string | null
  assignments: StoredAssignment[]
  activity: Activity[]
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
}

/** A sign-in account in the IdP directory, for linking by hand. */
export type DirectoryAccount = { sub: string; name: string; email: string }

export type PeopleStore = {
  people: StoredPerson[]
  byId: Map<string, StoredPerson>
  directory: DirectoryAccount[]
  nextAssignment: number
}

/** Roles PoliNetwork Auth binds to People. Events has no Lead role bound, so nobody can be appointed its Lead. */
export const BOUND_TEAM_ROLES = {
  it: { member: true, lead: true },
  hr: { member: true, lead: true },
  design: { member: true, lead: true },
  events: { member: true, lead: false },
} satisfies Record<TeamId, { member: boolean; lead: boolean }>

/** Accounts fake Auth refuses every change for, as if their assigner had lost clearance. */
export const REFUSING_ACCOUNTS = new Set(["sub-0012"])
export const REFUSAL = "The actor can't give a role with permissions they don't hold: tg:messages:delete"

const FIRST = [
  "Giulia",
  "Marco",
  "Sara",
  "Luca",
  "Chiara",
  "Matteo",
  "Francesca",
  "Davide",
  "Elena",
  "Alessandro",
  "Martina",
  "Lorenzo",
  "Alice",
  "Federico",
  "Giorgia",
  "Riccardo",
  "Beatrice",
  "Tommaso",
  "Anna",
  "Simone",
  "Sofia",
  "Andrea",
  "Ilaria",
  "Pietro",
  "Valentina",
  "Gabriele",
  "Laura",
  "Nicolò",
  "Camilla",
  "Filippo",
  "Arianna",
  "Edoardo",
  "Noemi",
  "Stefano",
  "Irene",
  "Emanuele",
  "Marta",
  "Giacomo",
  "Elisa",
  "Paolo",
]
const LAST = [
  "Rossi",
  "Bianchi",
  "Colombo",
  "Ferrari",
  "Russo",
  "Romano",
  "Gallo",
  "Costa",
  "Fontana",
  "Conti",
  "Esposito",
  "Ricci",
  "Bruno",
  "Moretti",
  "Marino",
  "Greco",
  "Barbieri",
  "Lombardi",
  "Giordano",
  "Rinaldi",
  "Caruso",
  "Ferrara",
  "Galli",
  "Martini",
  "Leone",
  "Longo",
  "Gentile",
  "Martinelli",
  "Vitale",
  "Serra",
  "Coppola",
  "De Luca",
  "Mancini",
  "Santoro",
  "Marchetti",
  "Cattaneo",
  "Fabbri",
  "Pellegrini",
  "Villa",
  "Ferri",
]

const HR_SUB = "sub-0002"

const course = (
  code: number,
  name: string,
  level: Course["level"],
  school: Course["school"],
  regulation: string,
  campuses: string[],
  languages: string[],
  active = true
): Course => ({
  code,
  name,
  level,
  school,
  regulation,
  campuses,
  languages,
  active,
})

/**
 * A sample of Politecnico's real courses (the backend's 2026/27 list) across the four schools and three levels, in
 * `courses.list` order (school, level, name). Ingegneria Informatica is listed under both regulations, as Polimi does
 * while the older one's students finish; Computer Science and Engineering's older version (481) is no longer offered:
 * a record that still points to it keeps it.
 */
export const SAMPLE_COURSES: Course[] = [
  course(
    1031,
    "Progettazione dell'Architettura",
    "bachelor",
    "auic",
    "96/23",
    ["Milano Leonardo", "Mantova", "Piacenza"],
    ["Italiano", "Inglese"]
  ),
  course(1015, "Architettura", "master", "auic", "96/23", ["Milano Leonardo"], ["Italiano", "Inglese"]),
  course(1033, "Ingegneria Edile - Architettura", "single-cycle", "auic", "96/23", ["Lecco"], ["Italiano"]),
  course(507, "Ingegneria Civile", "bachelor", "icat", "96/23", ["Milano Leonardo"], ["Italiano", "Inglese"]),
  course(
    508,
    "Ingegneria per l'Ambiente e il Territorio",
    "bachelor",
    "icat",
    "96/23",
    ["Milano Leonardo"],
    ["Italiano"]
  ),
  course(
    512,
    "Ingegneria Civile - Civil Engineering",
    "master",
    "icat",
    "96/23",
    ["Milano Leonardo"],
    ["Italiano", "Inglese"]
  ),
  course(514, "Ingegneria Aerospaziale", "bachelor", "3i", "96/23", ["Milano Bovisa"], ["Italiano"]),
  course(530, "Ingegneria Gestionale - BV", "bachelor", "3i", "96/23", ["Milano Bovisa"], ["Italiano"]),
  course(531, "Ingegneria Informatica", "bachelor", "3i", "96/23", ["Milano Leonardo", "Cremona"], ["Italiano"]),
  course(358, "Ingegneria Informatica", "bachelor", "3i", "270", ["Milano Leonardo", "Cremona"], ["Italiano"]),
  course(535, "Ingegneria Meccanica - PC", "bachelor", "3i", "96/23", ["Piacenza"], ["Italiano"]),
  course(542, "Computer Science and Engineering", "master", "3i", "96/23", ["Milano Leonardo"], ["Inglese"]),
  course(
    481,
    "Computer Science and Engineering - Ingegneria Informatica",
    "master",
    "3i",
    "270",
    ["Milano Leonardo"],
    ["Inglese"],
    false
  ),
  course(552, "Management Engineering", "master", "3i", "96/23", ["Milano Bovisa"], ["Inglese"]),
  course(1021, "Design della Comunicazione", "bachelor", "design", "96/23", ["Milano Bovisa"], ["Italiano"]),
  course(1020, "Design del Prodotto Industriale", "bachelor", "design", "96/23", ["Milano Bovisa"], ["Italiano"]),
  course(1026, "Digital and Interaction Design", "master", "design", "96/23", ["Milano Bovisa"], ["Inglese"]),
].toSorted(
  (a, b) =>
    SCHOOL_IDS.indexOf(a.school) - SCHOOL_IDS.indexOf(b.school) ||
    COURSE_LEVELS.indexOf(a.level) - COURSE_LEVELS.indexOf(b.level) ||
    a.name.localeCompare(b.name, "it") ||
    a.code - b.code
)

type Profile = Pick<
  StoredPerson,
  "courseCode" | "campus" | "otherAssociations" | "representativeRoles" | "representativeOther"
>

/**
 * The profile from the 2026 admin census, for some records: student representatives (one on a CCS and the Comitato
 * Sportivo), a course no longer offered, an external member with no course, and records nobody filled in.
 */
const PROFILES = new Map<number, Partial<Profile>>([
  [
    1,
    {
      courseCode: 358,
      campus: "leonardo",
      otherAssociations: ["Skyward Experimental Rocketry"],
    },
  ],
  [2, { courseCode: 552, campus: "bovisa" }],
  [
    3,
    {
      courseCode: 530,
      campus: "bovisa",
      otherAssociations: ["Lista Aperta"],
      representativeRoles: ["ccs", "other"],
      representativeOther: "Comitato Sportivo",
    },
  ],
  [4, { courseCode: 531, campus: "cremona" }],
  [
    5,
    {
      courseCode: 1021,
      campus: "bovisa",
      representativeRoles: ["school"],
      otherAssociations: ["Lista Aperta"],
    },
  ],
  [6, { courseCode: 507, campus: "leonardo" }],
  [
    7,
    {
      courseCode: 542,
      campus: "leonardo",
      representativeRoles: ["senate"],
      otherAssociations: ["Lista Aperta"],
    },
  ],
  [9, { courseCode: 481, campus: "leonardo" }],
  [10, { campus: "leonardo", representativeRoles: ["board"] }],
  [
    11,
    {
      courseCode: 535,
      campus: "piacenza",
      otherAssociations: ["Polimi Motorsport", "ESN Politecnico Milano"],
    },
  ],
  [12, { courseCode: 1033, campus: "lecco" }],
  [
    13,
    {
      courseCode: 514,
      campus: "bovisa",
      otherAssociations: ["Skyward Experimental Rocketry"],
    },
  ],
  [16, { courseCode: 1031, campus: "leonardo" }],
  [
    21,
    {
      courseCode: 358,
      campus: "leonardo",
      otherAssociations: ["ESN Politecnico Milano"],
    },
  ],
  [22, { courseCode: 542, campus: "leonardo" }],
  [30, { courseCode: 1026, campus: "bovisa" }],
  [31, { courseCode: 1020, campus: "bovisa" }],
  [40, { campus: "external" }],
])

function profileOf(n: number): Profile {
  return {
    courseCode: null,
    campus: null,
    otherAssociations: [],
    representativeRoles: [],
    representativeOther: null,
    ...PROFILES.get(n),
  }
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function pad(value: number) {
  return String(value).padStart(4, "0")
}

export function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
}

/** Which record has which account, invite and roles; the numbers are record IDs. */
const LINKED = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 30, 31, 33, 36])
const INVITED = new Set([8, 11, 14, 26, 34])
const EXPIRED_INVITE = 14
const ADMINS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
/** Capo Admins and the admins who answer to each. */
const CAPOS = [
  { capo: 7, scope: "Ingegneria Informatica", admins: [9, 10, 11, 12] },
  { capo: 3, scope: "Ingegneria Gestionale", admins: [13, 14, 15] },
  { capo: 5, scope: "Design", admins: [16, 17, 18] },
]
const TEAMS_OF = {
  it: { lead: 7, members: [1, 21, 22, 23, 24, 25], former: [28] },
  hr: { lead: 2, members: [26, 27, 29], former: [] },
  design: { lead: 30, members: [31, 32, 33], former: [35] },
  events: { lead: null, members: [39, 40, 34], former: [] },
} satisfies Record<TeamId, { lead: number | null; members: number[]; former: number[] }>
/** Sent to Auth and not confirmed: an admin start and a team end. */
const WAITING = { admin: 19, teamEnd: 24 }

const FIELDS = {
  it: (n) => ({
    github: `dev${n}`,
    areas: n % 2 ? ["Frontend", "Backend"] : ["Bot"],
  }),
  hr: (n) => ({ focus: n % 2 ? ["Recruiting"] : ["Onboarding", "Census"] }),
  design: (n) => ({
    tools: n % 2 ? ["Figma", "Illustrator"] : ["Photoshop"],
    portfolio: "",
  }),
  events: (n) => ({ focus: n % 2 ? ["Partnerships"] : ["Logistics"] }),
} satisfies Record<TeamId, (n: number) => Record<string, string | string[]>>

export function buildPeopleStore(): PeopleStore {
  const now = today()
  let nextAssignment = 1
  const people: StoredPerson[] = []

  for (let n = 1; n <= 40; n++) {
    const firstName = FIRST[n - 1] ?? "Persona"
    const lastName = LAST[(n * 7) % LAST.length] ?? "Rossi"
    const linked = LINKED.has(n)
    const createdAt = `${addDays(now, -200 + n)}T09:00:00.000Z`
    const linkedOn = linked ? addDays(now, n <= 6 ? -60 - n : n % 3 === 0 ? -(n % 25) : -40 - n) : null
    const person: StoredPerson = {
      id: `P-${pad(n)}`,
      firstName,
      lastName,
      // P-0040 has no contact email, so it can't be invited.
      contactEmail: n === 40 ? null : `${slug(firstName)}.${slug(lastName)}@example.org`,
      phone: n % 3 === 0 ? `+39 3${pad(n * 37).slice(0, 2)} ${pad(n * 91)}${pad(n * 13).slice(0, 3)}` : null,
      telegramUsername: n % 4 === 0 ? null : `${slug(firstName)}${slug(lastName)}`,
      notes: n === 6 ? "Prefers to be contacted on Telegram." : null,
      accountSub: linked ? `sub-${pad(n)}` : null,
      linkMethod: linked ? (n === 27 ? "auth" : n % 2 ? "invite" : "manual") : null,
      linkedOn,
      linkedBy: linked ? (n === 27 ? "auth" : n % 2 ? `sub-${pad(n)}` : HR_SUB) : null,
      invite: INVITED.has(n)
        ? {
            email: `${slug(firstName)}.${slug(lastName)}@example.org`,
            sentOn: addDays(now, n === EXPIRED_INVITE ? -20 : -n % 10),
            expiresOn: addDays(now, n === EXPIRED_INVITE ? -6 : 14 - (n % 10)),
            sentBy: HR_SUB,
          }
        : null,
      ...profileOf(n),
      assignments: [],
      activity: [
        ...(linked && linkedOn
          ? [
              {
                actor: n === 27 ? "auth" : n % 2 ? `sub-${pad(n)}` : HR_SUB,
                text:
                  n === 27
                    ? "Created the record for the account's roles in PoliNetwork Auth"
                    : `Linked account sub-${pad(n)} (${n % 2 ? "email invite" : "by hand"})`,
                at: `${linkedOn}T10:00:00.000Z`,
              },
            ]
          : []),
        {
          actor: n === 27 ? "auth" : HR_SUB,
          text: "Created the record",
          at: createdAt,
        },
      ],
      createdBy: n === 27 ? "auth" : HR_SUB,
      createdAt,
      updatedBy: HR_SUB,
      updatedAt: createdAt,
    }
    people.push(person)
  }

  const byNumber = (n: number) => {
    const person = people[n - 1]
    if (!person) throw new Error(`No sample record ${n}`)
    return person
  }
  const assign = (n: number, fields: Partial<StoredAssignment> & Pick<Assignment, "kind" | "since">) => {
    const person = byNumber(n)
    const assignment: StoredAssignment = {
      id: `A-${pad(nextAssignment++)}`,
      team: null,
      teamRole: null,
      capoScope: null,
      capoOfReference: null,
      fields: {},
      endedOn: null,
      endReason: null,
      assignedBy: person.linkMethod === "auth" ? "auth" : HR_SUB,
      change: "start",
      status: person.accountSub ? "applied" : "pending",
      refusal: null,
      settlesAt: null,
      ...fields,
    }
    person.assignments.push(assignment)
    return assignment
  }
  const ref = (n: number) => ({
    id: byNumber(n).id,
    name: `${byNumber(n).firstName} ${byNumber(n).lastName}`,
  })

  for (const n of ADMINS) {
    const capo = CAPOS.find((entry) => entry.admins.includes(n))?.capo
    const admin = assign(n, {
      kind: "admin",
      since: addDays(now, -300 + n * 5),
      capoOfReference: capo ? ref(capo) : null,
    })
    if (n === WAITING.admin) admin.status = "sent"
  }
  CAPOS.forEach(({ capo, scope }, index) =>
    assign(capo, {
      kind: "capo",
      since: addDays(now, -120 + index * 10),
      capoScope: scope,
    })
  )
  // A former admin, and an admin role Auth refused to give (the record shows why; nobody assigned it again).
  assign(1, {
    kind: "admin",
    since: addDays(now, -500),
    endedOn: addDays(now, -200),
    endReason: "Graduated",
  })
  assign(12, {
    kind: "capo",
    since: addDays(now, -30),
    capoScope: "Ingegneria Meccanica",
    endedOn: addDays(now, -30),
    endReason: "Refused by PoliNetwork Auth",
    status: "refused",
    refusal: REFUSAL,
  })

  for (const team of TEAM_IDS) {
    const roster: { lead: number | null; members: number[]; former: number[] } = TEAMS_OF[team]
    const since = (n: number) => addDays(now, -400 + n * 9)
    if (roster.lead)
      assign(roster.lead, {
        kind: "team",
        team,
        teamRole: "lead",
        since: since(roster.lead),
      })
    for (const n of roster.members) {
      const assignment = assign(n, {
        kind: "team",
        team,
        teamRole: "member",
        since: since(n),
        fields: FIELDS[team](n),
      })
      if (n === WAITING.teamEnd)
        Object.assign(assignment, {
          endedOn: now,
          endReason: "Moved to another team",
          change: "end",
          status: "sent",
        })
    }
    for (const n of roster.former)
      assign(n, {
        kind: "team",
        team,
        teamRole: "member",
        since: since(n),
        endedOn: addDays(now, -20),
        endReason: "No longer has time",
        change: "end",
        fields: FIELDS[team](n),
      })
  }
  // Auth refused to end this membership: the role is still held, and the record says why.
  const refusedEnd = byNumber(22).assignments.find((assignment) => assignment.team === "it")
  if (refusedEnd)
    Object.assign(refusedEnd, {
      change: "end",
      status: "refused",
      refusal: REFUSAL,
    })

  const directory: DirectoryAccount[] = [
    ...people.flatMap((person) =>
      person.accountSub
        ? [
            {
              sub: person.accountSub,
              name: `${person.firstName} ${person.lastName}`,
              email: accountEmail(person),
            },
          ]
        : []
    ),
    // Accounts nobody linked yet: some belong to people on the register, under another address.
    { sub: "sub-0101", name: "Sara Colombo", email: "sara.c.2003@gmail.com" },
    {
      sub: "sub-0102",
      name: "Davide Gallo",
      email: "davide.gallo@mail.polimi.it",
    },
    {
      sub: "sub-0103",
      name: "Marta Fabbri",
      email: "marta.fabbri@polinetwork.org",
    },
    { sub: "sub-0104", name: "Luca Ferrari", email: "lferrari99@gmail.com" },
    {
      sub: "sub-0105",
      name: "Ospite Esterno",
      email: "guest.account@gmail.com",
    },
  ]

  return {
    people,
    byId: new Map(people.map((person) => [person.id, person])),
    directory,
    nextAssignment,
  }
}

/** The sign-in a linked record uses: a PoliNetwork account for some, a personal Google account for others. */
function accountEmail(person: StoredPerson) {
  const local = `${slug(person.firstName)}.${slug(person.lastName)}`
  return Number(person.id.slice(2)) % 2 ? `${local}@polinetwork.org` : `${local}@gmail.com`
}
