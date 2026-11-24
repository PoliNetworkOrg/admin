import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"

// Run the agent-mode People API under Node, resolving the same extensionless source imports as Vite.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { fakePeopleApi } = await import("../src/features/people/people.fake.server.ts")
const { createPersonInputSchema, newPersonInputSchema, updatePersonInputSchema } =
  await import("../src/features/people/people.contract.ts")

const ALL = ["people:read", "people:write", "people:appoint", "people:link", "people:self"]
const hr = fakePeopleApi({ permissions: ALL, personId: "P-0002" })
const base = {
  firstName: "Giulia",
  lastName: "Test",
  contactEmail: "",
  phone: "",
  telegramUsername: "",
}

void test("courses.list returns every course, sorted by school, level and name, with an inactive one", async () => {
  const courses = await hr.listCourses()
  const schools = ["auic", "icat", "3i", "design"]
  const levels = ["bachelor", "master", "single-cycle"]
  const key = (course) => [schools.indexOf(course.school), levels.indexOf(course.level)]
  for (let i = 1; i < courses.length; i++) {
    const [a, b] = [key(courses[i - 1]), key(courses[i])]
    assert.ok(a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]), `${courses[i].name} is out of order`)
  }
  assert.ok(courses.some((course) => !course.active))
  assert.deepEqual(new Set(courses.map((course) => course.school)), new Set(schools))
  assert.deepEqual(new Set(courses.map((course) => course.level)), new Set(levels))
})

void test("the schema refuses duplicates and a seat text without the Other seat", () => {
  const parse = (extra) => createPersonInputSchema.safeParse({ ...base, ...extra }).success
  assert.equal(parse({ otherAssociations: ["Lista Aperta", "lista aperta"] }), false)
  assert.equal(parse({ representativeRoles: ["senate", "senate"] }), false)
  assert.equal(parse({ representativeRoles: ["other"], representativeOther: "" }), false)
  assert.equal(
    parse({
      representativeRoles: ["senate"],
      representativeOther: "Comitato Sportivo",
    }),
    false
  )
  assert.equal(parse({ courseCode: null, representativeRoles: ["ccs"] }), false)
  assert.equal(
    parse({
      courseCode: 358,
      representativeRoles: ["ccs", "other"],
      representativeOther: " CS ",
    }),
    true
  )
  assert.equal(updatePersonInputSchema.safeParse({ ...base, id: "P-0001" }).success, true)
  assert.equal(
    newPersonInputSchema.safeParse({
      ...base,
      admin: false,
      capoScope: null,
      teams: [],
      courseCode: 0,
    }).success,
    false
  )
})

void test("create applies the rules on the record as it will be saved", async () => {
  await assert.rejects(hr.createPerson({ ...base, representativeRoles: ["school"] }), /course/)
  await assert.rejects(hr.createPerson({ ...base, courseCode: 377 }), /no longer offered/)
  await assert.rejects(hr.createPerson({ ...base, courseCode: 99999 }), /No course/)
  await assert.rejects(hr.createPerson({ ...base, representativeRoles: ["other"] }), /other seat/)

  const { id } = await hr.createPerson({
    ...base,
    courseCode: 358,
    campus: "cremona",
    otherAssociations: ["Lista Aperta", "LISTA APERTA", "Skyward Experimental Rocketry"],
    representativeRoles: ["other", "ccs"],
    representativeOther: "Comitato Sportivo",
  })
  const person = await hr.getPerson(id)
  assert.equal(person.course?.code, 358)
  assert.equal(person.campus, "cremona")
  assert.deepEqual(person.otherAssociations, ["Lista Aperta", "Skyward Experimental Rocketry"])
  assert.deepEqual(person.representativeRoles, ["ccs", "other"])
  assert.equal(person.representativeOther, "Comitato Sportivo")
  const texts = person.activity.map((entry) => entry.text)
  assert.ok(texts.includes("Course set to Ingegneria Informatica (358)"))
  assert.ok(texts.includes("Representative roles set to CCS, Other (Comitato Sportivo)"))

  const bare = await hr.getPerson((await hr.createPerson(base)).id)
  assert.equal(bare.course, null)
  assert.equal(bare.campus, null)
  assert.deepEqual(bare.otherAssociations, [])
  assert.deepEqual(bare.representativeRoles, [])
})

void test("update leaves omitted fields unchanged and re-checks the merged record", async () => {
  const { id } = await hr.createPerson({
    ...base,
    courseCode: 358,
    campus: "leonardo",
    representativeRoles: ["ccs", "other"],
    representativeOther: "Comitato Sportivo",
  })
  await hr.updatePerson({ ...base, id, firstName: "Giulia Maria" })
  let person = await hr.getPerson(id)
  assert.equal(person.course?.code, 358)
  assert.deepEqual(person.representativeRoles, ["ccs", "other"])

  // Clearing the course while a CCS seat stays is refused.
  await assert.rejects(hr.updatePerson({ ...base, id, courseCode: null }), /course/)
  // Removing Other clears its text.
  await hr.updatePerson({ ...base, id, representativeRoles: ["ccs"] })
  person = await hr.getPerson(id)
  assert.equal(person.representativeOther, null)
  // Text alone, without the Other seat, is refused.
  await assert.rejects(hr.updatePerson({ ...base, id, representativeOther: "Comitato Sportivo" }), /Other seat/)

  await hr.updatePerson({ ...base, id, campus: "bovisa" })
  person = await hr.getPerson(id)
  assert.ok(person.activity.slice(0, 2).some((entry) => entry.text === "Campus changed to Bovisa"))
})

void test("a record keeps a course that is no longer offered", async () => {
  const records = await Promise.all((await hr.listPeople()).map((row) => hr.getPerson(row.id)))
  const inactive = records.find((person) => person.course && !person.course.active)
  assert.ok(inactive, "a sample record points to an inactive course")
  await hr.updatePerson({
    ...base,
    id: inactive.id,
    courseCode: inactive.course.code,
  })
  assert.equal((await hr.getPerson(inactive.id)).course?.code, inactive.course.code)
  assert.ok(records.some((person) => person.representativeRoles.includes("other") && person.representativeOther))
  assert.ok(records.some((person) => person.course === null && person.campus !== null))
})

void test("associations and seats need people:read; suggestions are most used first", async () => {
  const suggestions = await hr.suggestAssociations()
  assert.equal(suggestions[0], "Lista Aperta")
  assert.equal(new Set(suggestions).size, suggestions.length)

  const self = fakePeopleApi({
    permissions: ["people:self"],
    personId: "P-0003",
  })
  await assert.rejects(self.suggestAssociations(), { message: "UNAUTHORIZED" })
  await assert.rejects(self.listCourses(), { message: "UNAUTHORIZED" })
  const area = await self.getMyArea()
  assert.equal(area.state, "linked")
  assert.deepEqual(area.person.otherAssociations, [])
  assert.deepEqual(area.person.representativeRoles, [])
  assert.equal(area.person.representativeOther, null)
  assert.notEqual(area.person.course, null)
})
