import {
  type Account,
  type AdminRole,
  CAMPUSES,
  type PersonRecord,
  type TeamFields,
  type TeamId,
  type TeamMembership,
} from "./people.contract"

/**
 * Agent-mode sample data for the People area, ported from the prototype's `buildData()` (docs/people/prototype):
 * 148 people, ~40 linked accounts, ~110 admins and 27 team members, with the same seed and key people. Soci, fees,
 * receipts, the census and record matching are gone (#138); their mockups keep their own data in `mockup-data.ts`.
 */

export type FamilyId = "inf" | "ges" | "ind" | "ele" | "des" | "arc"

/** A record as the fake backend stores it: the contract's record plus what it derives views from. */
export type StoredPerson = Omit<PersonRecord, "discrepancies"> & {
  family: FamilyId
  /** A Telegram username reported elsewhere that differs from the record: a `telegram-mismatch` discrepancy. */
  censusTelegram: string | null
}

export type PeopleStore = {
  people: StoredPerson[]
  byId: Map<string, StoredPerson>
}

const FIRST = [
  "Giulia",
  "Davide",
  "Sara",
  "Matteo",
  "Elena",
  "Marta",
  "Luca",
  "Marco",
  "Chiara",
  "Federico",
  "Alessia",
  "Tommaso",
  "Francesca",
  "Lorenzo",
  "Sofia",
  "Andrea",
  "Martina",
  "Alessandro",
  "Giorgia",
  "Riccardo",
  "Beatrice",
  "Simone",
  "Valentina",
  "Gabriele",
  "Aurora",
  "Pietro",
  "Camilla",
  "Edoardo",
  "Ludovica",
  "Filippo",
  "Noemi",
  "Nicolò",
  "Elisa",
  "Giacomo",
  "Anna",
  "Stefano",
  "Irene",
  "Michele",
  "Greta",
  "Emanuele",
  "Ilaria",
  "Daniele",
  "Arianna",
  "Leonardo",
  "Benedetta",
  "Samuele",
  "Rebecca",
  "Christian",
  "Alice",
  "Mattia",
  "Gaia",
  "Jacopo",
  "Laura",
  "Alberto",
  "Silvia",
  "Paolo",
  "Eleonora",
  "Antonio",
  "Caterina",
  "Vittoria",
  "Giovanni",
  "Margherita",
  "Enrico",
  "Carlotta",
  "Fabio",
  "Bianca",
  "Diego",
  "Serena",
  "Nicole",
  "Manuel",
  "Federica",
  "Kevin",
  "Asia",
  "Yasmine",
  "Omar",
]

const LAST = [
  "Rossi",
  "Russo",
  "Ferrari",
  "Esposito",
  "Bianchi",
  "Romano",
  "Colombo",
  "Ricci",
  "Marino",
  "Greco",
  "Bruno",
  "Gallo",
  "Conti",
  "De Luca",
  "Mancini",
  "Costa",
  "Giordano",
  "Rizzo",
  "Lombardi",
  "Moretti",
  "Barbieri",
  "Fontana",
  "Santoro",
  "Mariani",
  "Rinaldi",
  "Caruso",
  "Ferri",
  "Galli",
  "Martini",
  "Leone",
  "Longo",
  "Gentile",
  "Martinelli",
  "Vitale",
  "Lombardo",
  "Serra",
  "Coppola",
  "De Santis",
  "D'Angelo",
  "Marchetti",
  "Parisi",
  "Villa",
  "Conte",
  "Ferraro",
  "Fabbri",
  "Bianco",
  "Marini",
  "Grasso",
  "Valentini",
  "Messina",
  "Sala",
  "De Angelis",
  "Gatti",
  "Pellegrini",
  "Palumbo",
  "Sanna",
  "Farina",
  "Rizzi",
  "Monti",
  "Cattaneo",
  "Morelli",
  "Amato",
  "Silvestri",
  "Mazza",
  "Testa",
  "Grassi",
  "Carbone",
  "Giuliani",
  "Benedetti",
  "Barone",
  "Caputo",
  "Montanari",
  "Guerra",
  "Palmieri",
  "Bernardi",
  "Fiore",
  "De Rosa",
  "Ferretti",
  "Bellini",
  "Basile",
  "Riva",
  "Donati",
  "Piras",
  "Sartori",
  "Neri",
  "Milani",
  "Pagano",
  "Orlando",
  "Negri",
  "Brambilla",
  "Crippa",
  "Mauri",
  "Pozzi",
  "Galbiati",
]

type Course = { name: string; family: FamilyId; campuses: string[]; degree: "b" | "m"; weight: number }

const COURSES: Course[] = [
  {
    name: "Ingegneria Informatica",
    family: "inf",
    campuses: ["Leonardo", "Leonardo", "Leonardo", "Cremona"],
    degree: "b",
    weight: 11,
  },
  { name: "Computer Science and Engineering", family: "inf", campuses: ["Leonardo"], degree: "m", weight: 3 },
  { name: "Ingegneria Gestionale", family: "ges", campuses: ["Bovisa", "Bovisa", "Cremona"], degree: "b", weight: 7 },
  { name: "Management Engineering", family: "ges", campuses: ["Bovisa"], degree: "m", weight: 2 },
  { name: "Ingegneria Meccanica", family: "ind", campuses: ["Bovisa", "Piacenza", "Lecco"], degree: "b", weight: 5 },
  { name: "Ingegneria Aerospaziale", family: "ind", campuses: ["Bovisa"], degree: "b", weight: 4 },
  { name: "Ingegneria Energetica", family: "ind", campuses: ["Bovisa", "Piacenza"], degree: "b", weight: 2 },
  { name: "Ingegneria Chimica", family: "ind", campuses: ["Leonardo"], degree: "b", weight: 2 },
  { name: "Ingegneria Elettronica", family: "ele", campuses: ["Leonardo"], degree: "b", weight: 3 },
  { name: "Ingegneria Biomedica", family: "ele", campuses: ["Leonardo"], degree: "b", weight: 4 },
  { name: "Ingegneria Matematica", family: "ele", campuses: ["Leonardo"], degree: "b", weight: 2 },
  { name: "Design della Comunicazione", family: "des", campuses: ["Bovisa"], degree: "b", weight: 4 },
  { name: "Design del Prodotto Industriale", family: "des", campuses: ["Bovisa"], degree: "b", weight: 3 },
  { name: "Design degli Interni", family: "des", campuses: ["Bovisa"], degree: "b", weight: 2 },
  { name: "Architettura", family: "arc", campuses: ["Leonardo", "Mantova", "Piacenza"], degree: "b", weight: 4 },
  { name: "Ingegneria Civile", family: "arc", campuses: ["Leonardo", "Lecco"], degree: "b", weight: 2 },
]

export const COURSE_NAMES = COURSES.map((course) => course.name)

/** The Capo Admin scope of each family of courses. */
export const FAMILIES = {
  inf: { scope: "Ingegneria Informatica" },
  ges: { scope: "Ingegneria Gestionale" },
  ind: { scope: "Ingegneria Industriale" },
  ele: { scope: "Ingegneria dell'Informazione" },
  des: { scope: "Design" },
  arc: { scope: "Architettura" },
} satisfies Record<FamilyId, { scope: string }>

export const FAMILY_IDS: FamilyId[] = ["inf", "ges", "ind", "ele", "des", "arc"]

const REPS = ["Consiglio di Corso di Studio", "Giunta di Scuola", "Consiglio degli Studenti", "Senato Accademico"]
const ASSOCIATIONS = [
  "Skyward",
  "Dynamis PRC",
  "ESN Politecnico Milano",
  "BEST Milano",
  "JEMP",
  "PoliMi Sailing Team",
  "Poli Radio",
]
const NOTES = [
  "Prefers to be contacted on Telegram.",
  "Away on Erasmus from February to July.",
  "Interested in joining IT next semester.",
  "Asked to step down as admin at the end of the year.",
  "Helped run the freshers' open day.",
]

type KeyPerson = {
  first: string
  last: string
  course: string
  family: FamilyId
  year: string
  campus: string
  tg: string
}

const KEYS = {
  "P-0142": {
    first: "Giulia",
    last: "Rossi",
    course: "Ingegneria Informatica",
    family: "inf",
    year: "2nd year",
    campus: "Leonardo",
    tg: "giuliarossi",
  },
  "P-0098": {
    first: "Davide",
    last: "Russo",
    course: "Computer Science and Engineering",
    family: "inf",
    year: "1st year MSc",
    campus: "Leonardo",
    tg: "davide_russo",
  },
  "P-0034": {
    first: "Sara",
    last: "Galli",
    course: "Computer Science and Engineering",
    family: "inf",
    year: "2nd year MSc",
    campus: "Leonardo",
    tg: "saragalli",
  },
  "P-0115": {
    first: "Matteo",
    last: "Conti",
    course: "Ingegneria Informatica",
    family: "inf",
    year: "2nd year",
    campus: "Leonardo",
    tg: "matteoconti",
  },
  "P-0063": {
    first: "Elena",
    last: "Ricci",
    course: "Ingegneria Gestionale",
    family: "ges",
    year: "2nd year",
    campus: "Bovisa",
    tg: "elenaricci",
  },
  "P-0007": {
    first: "Marta",
    last: "Colombo",
    course: "Management Engineering",
    family: "ges",
    year: "2nd year MSc",
    campus: "Bovisa",
    tg: "martacolombo",
  },
  "P-0021": {
    first: "Luca",
    last: "Ferri",
    course: "Ingegneria Biomedica",
    family: "ele",
    year: "3rd year",
    campus: "Leonardo",
    tg: "lucaferri",
  },
  "P-0045": {
    first: "Alessia",
    last: "Fontana",
    course: "Design della Comunicazione",
    family: "des",
    year: "3rd year",
    campus: "Bovisa",
    tg: "alessiafontana",
  },
  "P-0052": {
    first: "Tommaso",
    last: "Greco",
    course: "Architettura",
    family: "arc",
    year: "2nd year",
    campus: "Mantova",
    tg: "tommygreco",
  },
  "P-0088": {
    first: "Marco",
    last: "Bianchi",
    course: "Ingegneria Meccanica",
    family: "ind",
    year: "2nd year",
    campus: "Piacenza",
    tg: "marcobianchi",
  },
  "P-0131": {
    first: "Chiara",
    last: "Esposito",
    course: "Design degli Interni",
    family: "des",
    year: "Graduated",
    campus: "External",
    tg: "chiaraesp",
  },
  "P-0076": {
    first: "Federico",
    last: "Marino",
    course: "Ingegneria Aerospaziale",
    family: "ind",
    year: "1st year",
    campus: "Bovisa",
    tg: "fedemarino",
  },
} satisfies Record<string, KeyPerson>

/** Lowercase ASCII without spaces or apostrophes, for emails and usernames. */
export function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['\s]/g, "")
    .toLowerCase()
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0")
}

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function campusOf(value: string) {
  const campus = CAMPUSES.find((candidate) => candidate === value)
  if (!campus) throw new Error(`Unknown campus ${value}`)
  return campus
}

export function buildPeopleStore(): PeopleStore {
  const random = mulberry32(1442)
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]
  const weighted = (items: Course[]) => {
    let remaining = random() * items.reduce((sum, item) => sum + item.weight, 0)
    for (const item of items) {
      remaining -= item.weight
      if (remaining < 0) return item
    }
    return items[items.length - 1]
  }
  const sample = <T>(items: readonly T[], count: number) => {
    const pool = [...items]
    const out: T[] = []
    while (out.length < count && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
    return out
  }
  const shuffle = <T>(items: readonly T[]) => {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1))
      ;[copy[index], copy[other]] = [copy[other], copy[index]]
    }
    return copy
  }
  const randomDate = (from: string, to: string) => {
    const start = Date.parse(`${from}T12:00:00Z`)
    const end = Date.parse(`${to}T12:00:00Z`)
    return new Date(start + Math.floor(random() * (end - start))).toISOString().slice(0, 10)
  }

  const used = new Set(Object.values(KEYS).map((key) => `${key.first} ${key.last}`))
  const people: StoredPerson[] = []
  for (let index = 0; index < 148; index++) {
    let first = pick(FIRST)
    let last = pick(LAST)
    while (used.has(`${first} ${last}`)) {
      first = pick(FIRST)
      last = pick(LAST)
    }
    used.add(`${first} ${last}`)
    const course = weighted(COURSES)
    let year =
      course.degree === "m"
        ? pick(["1st year MSc", "2nd year MSc"])
        : pick(["1st year", "2nd year", "2nd year", "3rd year", "3rd year"])
    if (random() < 0.06) year = "Graduated"
    const campus = year === "Graduated" && random() < 0.5 ? "External" : pick(course.campuses)
    const f = slug(first)
    const l = slug(last)
    const domain = pick([
      "gmail.com",
      "gmail.com",
      "gmail.com",
      "outlook.it",
      "icloud.com",
      "mail.polimi.it",
      "libero.it",
    ])
    const phone = `+39 3${Math.floor(random() * 10)}${Math.floor(random() * 10)} ${100 + Math.floor(random() * 900)} ${1000 + Math.floor(random() * 9000)}`
    const telegram =
      random() < 0.9
        ? pick([f + l, `${f}_${l[0]}`, f[0] + l, `${f}${l.slice(0, 3)}${10 + Math.floor(random() * 90)}`])
        : null
    people.push({
      id: `P-${pad(index + 1, 4)}`,
      family: course.family,
      profile: {
        firstName: first,
        lastName: last,
        personalEmail: `${f}.${l}@${domain}`,
        phone,
        telegramUsername: telegram,
        telegramId: String(110000000 + Math.floor(random() * 7800000000)),
        course: course.name,
        year,
        campus: campusOf(campus),
        otherAssociations: [],
        studentRepresentative: null,
      },
      admin: null,
      teams: [],
      consents: { privacy: null, photo: null },
      account: { status: "none" },
      notes: random() < 0.1 ? pick(NOTES) : null,
      activity: [],
      censusTelegram: null,
    })
  }
  const byId = new Map(people.map((person) => [person.id, person]))
  const person = (id: string) => {
    const found = byId.get(id)
    if (!found) throw new Error(`Unknown person ${id}`)
    return found
  }
  for (const [id, key] of Object.entries(KEYS)) {
    const target = person(id)
    target.family = key.family
    Object.assign(target.profile, {
      firstName: key.first,
      lastName: key.last,
      course: key.course,
      year: key.year,
      campus: campusOf(key.campus),
      telegramUsername: key.tg,
      personalEmail: `${slug(key.first)}.${slug(key.last)}@gmail.com`,
    })
  }
  person("P-0142").profile.personalEmail = "giulia.rossi.02@gmail.com"

  // Admin and team data accumulate here before the records get their contract shape.
  type Draft = { admin?: AdminRole & { assoc: string[]; rep: string | null }; teams: TeamMembership[] }
  const drafts = new Map<string, Draft>(people.map((p) => [p.id, { teams: [] }]))
  const draft = (p: StoredPerson) => drafts.get(p.id) ?? { teams: [] }

  const makeAdmin = (p: StoredPerson, status: "active" | "former") => {
    const rep = random() < 0.15 ? pick(REPS) : null
    const assoc = random() < 0.2 ? sample(ASSOCIATIONS, random() < 0.3 ? 2 : 1) : []
    const availableAsCapo = random() < 0.12
    const since = randomDate("2021-09-01", "2026-06-30")
    const endedOn = status === "former" ? randomDate("2026-09-20", "2026-10-10") : null
    const endReason = status === "former" ? pick(["Graduated", "No longer has time", "Moved abroad"]) : null
    draft(p).admin = {
      status,
      since,
      endedOn,
      endReason,
      availableAsCapo,
      capoOfReference: null,
      capoScope: null,
      assoc,
      rep,
    }
  }
  const teamFields = (team: TeamId, p: StoredPerson): TeamFields => {
    const first = slug(p.profile.firstName)
    const last = slug(p.profile.lastName)
    if (team === "it")
      return {
        github: first + last.slice(0, 4),
        areas: sample(["Frontend", "Backend", "Bot", "Infrastructure"], 1 + Math.floor(random() * 2)),
      }
    if (team === "design")
      return {
        tools: sample(
          ["Figma", "Illustrator", "Photoshop", "After Effects", "InDesign", "Premiere"],
          2 + Math.floor(random() * 2)
        ),
        portfolio: random() < 0.7 ? `behance.net/${first}${last}` : "",
      }
    if (team === "intl")
      return {
        languages: sample(
          ["English", "Spanish", "French", "German", "Chinese", "Portuguese"],
          1 + Math.floor(random() * 2)
        ),
      }
    const focus =
      team === "hr"
        ? ["Recruiting", "Onboarding", "Census", "Wellbeing"]
        : ["Partnerships", "Logistics", "Sponsorships", "Communication"]
    return { focus: sample(focus, 1 + Math.floor(random() * 2)) }
  }
  const makeTeam = (
    p: StoredPerson,
    team: TeamId,
    role: "member" | "lead" = "member",
    since?: string,
    fields?: TeamFields
  ): TeamMembership => ({
    team,
    role,
    since: since ?? randomDate("2023-01-10", "2026-09-30"),
    endedOn: null,
    endReason: null,
    fields: fields ?? teamFields(team, p),
  })

  const generic = shuffle(people.filter((p) => !(p.id in KEYS)))
  generic.slice(0, 96).forEach((p) => makeAdmin(p, "active"))
  generic.slice(96, 103).forEach((p) => makeAdmin(p, "former"))
  const slots: TeamId[] = [
    "it",
    "it",
    "it",
    "it",
    "it",
    "hr",
    "hr",
    "hr",
    "design",
    "design",
    "design",
    "design",
    "design",
    "design",
    "intl",
    "intl",
    "events",
    "events",
    "events",
    "events",
  ]
  ;[...generic.slice(18, 30), ...generic.slice(127, 135)].forEach((p, index) =>
    draft(p).teams.push(makeTeam(p, slots[index]))
  )
  draft(generic[20]).teams.push(makeTeam(generic[20], "events"))
  for (const [p, team] of [
    [generic[135], "it"],
    [generic[100], "design"],
    [generic[40], "it"],
    [generic[60], "events"],
  ] as const) {
    const membership = makeTeam(p, team, "member", randomDate("2023-02-01", "2024-12-01"))
    membership.endedOn = randomDate("2026-01-10", "2026-09-30")
    membership.endReason = pick(["Graduated", "No longer has time", "Moved to another team"])
    draft(p).teams.push(membership)
  }

  const link = (p: StoredPerson) => {
    const account: Account = {
      status: "linked",
      email: p.profile.personalEmail ?? "",
      via: pick(["Telegram", "Google", "Microsoft 365"]),
      linkedOn: randomDate("2026-02-01", "2026-10-10"),
      how: pick(["Invite accepted", "Linked by Luca Ferri"]),
    }
    p.account = account
  }
  const invite = (p: StoredPerson, expired: boolean) => {
    const sentOn = expired ? randomDate("2026-09-08", "2026-09-24") : randomDate("2026-09-30", "2026-10-13")
    p.account = {
      status: "invite",
      email: p.profile.personalEmail ?? "",
      sentOn,
      expiresOn: addDays(sentOn, 14),
      sentBy: pick(["Luca Ferri", "Marta Colombo"]),
    }
  }
  ;[...generic.slice(0, 10), ...generic.slice(18, 30), ...generic.slice(103, 109), ...generic.slice(127, 132)].forEach(
    link
  )
  ;[...generic.slice(10, 18), ...generic.slice(109, 113)].forEach((p) =>
    invite(p, p === generic[11] || p === generic[110])
  )

  // Key people.
  const keyAdmin = (
    id: string,
    since: string,
    extra: Partial<AdminRole & { assoc: string[]; rep: string | null }> = {}
  ) => {
    const p = person(id)
    makeAdmin(p, "active")
    const admin = draft(p).admin
    if (!admin) return
    Object.assign(admin, { since, rep: null, assoc: [], availableAsCapo: false }, extra)
  }
  keyAdmin("P-0142", "2024-10-03", { availableAsCapo: true, rep: "Consiglio di Corso di Studio", assoc: ["Skyward"] })
  keyAdmin("P-0098", "2022-09-20", { assoc: ["JEMP"] })
  keyAdmin("P-0034", "2023-03-01")
  keyAdmin("P-0115", "2025-09-25", { rep: "Consiglio degli Studenti" })
  keyAdmin("P-0063", "2025-02-11")
  keyAdmin("P-0021", "2023-10-12")
  keyAdmin("P-0088", "2024-03-05")
  keyAdmin("P-0076", "2026-03-02")
  const chiara = person("P-0131")
  makeAdmin(chiara, "former")
  const chiaraAdmin = draft(chiara).admin
  if (chiaraAdmin) Object.assign(chiaraAdmin, { since: "2022-10-01", endedOn: "2026-07-10", endReason: "Graduated" })
  draft(chiara).teams.push({
    ...makeTeam(chiara, "design", "member", "2023-01-15"),
    endedOn: "2026-07-10",
    endReason: "Graduated",
  })

  draft(person("P-0034")).teams.push(
    makeTeam(person("P-0034"), "it", "lead", "2023-02-10", {
      github: "saragalli",
      areas: ["Backend", "Infrastructure"],
    })
  )
  draft(person("P-0142")).teams.push(
    makeTeam(person("P-0142"), "it", "member", "2025-03-04", { github: "giuliarossi", areas: ["Frontend", "Bot"] })
  )
  draft(person("P-0115")).teams.push(
    makeTeam(person("P-0115"), "it", "member", "2025-10-01", { github: "mconti", areas: ["Bot"] })
  )
  draft(person("P-0021")).teams.push(
    makeTeam(person("P-0021"), "hr", "lead", "2024-01-15", { focus: ["Recruiting", "Onboarding"] })
  )
  draft(person("P-0045")).teams.push(
    makeTeam(person("P-0045"), "design", "lead", "2024-03-01", {
      tools: ["Figma", "Illustrator", "After Effects"],
      portfolio: "behance.net/alessiafontana",
    })
  )
  draft(person("P-0052")).teams.push(
    makeTeam(person("P-0052"), "intl", "lead", "2024-11-05", { languages: ["English", "Spanish"] })
  )
  draft(person("P-0007")).teams.push(
    makeTeam(person("P-0007"), "events", "lead", "2022-02-01", { focus: ["Partnerships", "Sponsorships"] })
  )
  for (const id of ["P-0098", "P-0034", "P-0115", "P-0063", "P-0007", "P-0021", "P-0045", "P-0052"]) link(person(id))
  const davideAccount = person("P-0098").account
  if (davideAccount.status === "linked") davideAccount.how = "Invite accepted"
  person("P-0142").account = {
    status: "invite",
    email: "giulia.rossi.02@gmail.com",
    sentOn: "2026-10-06",
    expiresOn: "2026-10-20",
    sentBy: "Luca Ferri",
  }
  invite(person("P-0076"), true)

  // Capo Admins: Davide for Informatica, the first generic active admin of every other family.
  const davideAdmin = draft(person("P-0098")).admin
  if (davideAdmin) davideAdmin.capoScope = FAMILIES.inf.scope
  const capoOf = new Map<FamilyId, StoredPerson>([["inf", person("P-0098")]])
  for (const family of FAMILY_IDS.slice(1)) {
    const capo = generic.find(
      (p) => p.family === family && draft(p).admin?.status === "active" && !draft(p).admin?.capoScope
    )
    const capoAdmin = capo && draft(capo).admin
    if (capo && capoAdmin) {
      capoAdmin.capoScope = FAMILIES[family].scope
      capoOf.set(family, capo)
    }
  }
  for (const p of people) {
    const admin = draft(p).admin
    const capo = capoOf.get(p.family)
    if (admin && capo && capo !== p) {
      admin.capoOfReference = { id: capo.id, name: `${capo.profile.firstName} ${capo.profile.lastName}` }
    }
  }

  // Admin and team roles take their contract shape, then consents from the first day of any role.
  for (const p of people) {
    const d = draft(p)
    if (d.admin) {
      const { assoc, rep, ...admin } = d.admin
      p.admin = admin
      p.profile.otherAssociations = assoc
      p.profile.studentRepresentative = rep
    }
    p.teams = d.teams
    const start = [p.admin?.since, ...p.teams.map((team) => team.since)]
      .filter((date): date is string => !!date)
      .sort()[0]
    if (start) {
      const roll = random()
      p.consents = {
        privacy: { version: start >= "2025-09-01" ? "3" : "2", acceptedOn: start },
        photo: roll < 0.8 ? { status: "granted", on: start } : roll < 0.95 ? { status: "denied", on: start } : null,
      }
    }
  }

  const giulia = person("P-0142")
  giulia.consents = {
    privacy: { version: "3", acceptedOn: "2026-09-21" },
    photo: { status: "granted", on: "2026-09-21" },
  }
  giulia.notes = "Strong on the bot codebase; Sara suggests her for IT co-lead next year."
  giulia.activity = [
    { actor: "Luca Ferri", text: "sent an invite to giulia.rossi.02@gmail.com", at: "2026-10-06T18:42:00+02:00" },
    { actor: "Sara Galli", text: "added Giulia to IT as Member", at: "2025-03-04T16:20:00+01:00" },
  ]
  person("P-0088").censusTelegram = "marco_bianchi"

  return { people, byId }
}
