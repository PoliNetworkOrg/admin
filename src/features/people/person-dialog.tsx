import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { type ChangeEvent, useState } from "react"

import { checkboxControl, fieldControl, fieldHintId, FormDialog, FormField, SelectField } from "@/components/primitives"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { yearOf } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { createPerson, updatePerson } from "./people-write.functions"
import { CAMPUSES, type Campus, COURSES, type PersonRow, TELEGRAM_USERNAME_PATTERN, YEARS } from "./people.contract"

type Year = (typeof YEARS)[number]

const SAVE_ERROR = "Couldn't save the person. Check the values and try again."
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validTelegram(value: string) {
  return value.trim() === "" || TELEGRAM_USERNAME_PATTERN.test(value.trim())
}

/** Add a person, or edit an existing record's profile (`person`). */
export function PersonDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonRow
}) {
  const create = useServerFn(createPerson)
  const update = useServerFn(updatePerson)
  const navigate = useNavigate()
  const refresh = useRefreshAfter()
  const initial = {
    firstName: person?.profile.firstName ?? "",
    lastName: person?.profile.lastName ?? "",
    personalEmail: person?.profile.personalEmail ?? "",
    phone: person?.profile.phone ?? "",
    telegramUsername: person?.profile.telegramUsername ? `@${person.profile.telegramUsername}` : "",
    course: person?.profile.course ?? "",
    year: person?.profile.year ? yearOf(person.profile.year) : null,
    campus: person?.profile.campus ?? null,
  }
  const [values, setValues] = useState(initial)
  const [admin, setAdmin] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const errors: Partial<Record<keyof typeof initial, string>> = submitted
    ? {
        firstName: values.firstName.trim() ? undefined : "Enter a first name.",
        lastName: values.lastName.trim() ? undefined : "Enter a last name.",
        personalEmail: EMAIL_PATTERN.test(values.personalEmail.trim()) ? undefined : "Enter a valid email address.",
        telegramUsername: validTelegram(values.telegramUsername)
          ? undefined
          : "Enter 5–32 letters, digits or underscores.",
        course: values.course.trim() ? undefined : "Choose a course.",
        year: values.year ? undefined : "Choose a year.",
        campus: values.campus ? undefined : "Choose a campus.",
      }
    : {}
  const dirty = JSON.stringify(values) !== JSON.stringify(initial) || admin

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    setSubmitted(true)
    const { year, campus } = values
    if (
      !values.firstName.trim() ||
      !values.lastName.trim() ||
      !EMAIL_PATTERN.test(values.personalEmail.trim()) ||
      !validTelegram(values.telegramUsername) ||
      !values.course.trim() ||
      !year ||
      !campus
    ) {
      return
    }
    const fields = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      personalEmail: values.personalEmail.trim(),
      phone: values.phone.trim(),
      telegramUsername: values.telegramUsername.trim(),
      course: values.course.trim(),
      year,
      campus,
    }
    try {
      if (person) {
        await update({ data: { ...fields, id: person.id } })
      } else {
        const created = await create({ data: { ...fields, admin } })
        await refresh("Person added.")
        onOpenChange(false)
        await navigate({ to: "/dashboard/people/$personId", params: { personId: created.id } })
        return
      }
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, SAVE_ERROR), { cause: caught })
    }
    await refresh("Profile saved.")
    onOpenChange(false)
  }

  const text = (key: "firstName" | "lastName" | "personalEmail" | "phone" | "telegramUsername", id: string) => ({
    id,
    value: values[key],
    onChange: (event: ChangeEvent<HTMLInputElement>) => set(key, event.target.value),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": fieldHintId(id),
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={person ? "Edit profile" : "Add person"}
      description={
        person
          ? "Changes are saved to the record and shown in its activity."
          : "Creates a record. The person doesn't need an account; you can invite them later."
      }
      noun="person"
      dirty={dirty}
      submitLabel={person ? "Save profile" : "Add person"}
      onSubmit={submit}
    >
      <div className="grid grid-cols-1 gap-4 shell:grid-cols-2">
        <FormField label="First name" htmlFor="person-first" error={errors.firstName}>
          <Input {...text("firstName", "person-first")} autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField label="Last name" htmlFor="person-last" error={errors.lastName}>
          <Input {...text("lastName", "person-last")} autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField label="Personal email" htmlFor="person-email" error={errors.personalEmail}>
          <Input {...text("personalEmail", "person-email")} type="email" autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField label="Phone" htmlFor="person-phone" optional>
          <Input {...text("phone", "person-phone")} type="tel" autoComplete="off" className={fieldControl} />
        </FormField>
        <FormField
          label="Telegram username"
          htmlFor="person-telegram"
          optional
          hint="Used to match the Telegram user the bot already knows."
          error={errors.telegramUsername}
        >
          <Input
            {...text("telegramUsername", "person-telegram")}
            placeholder="@username"
            autoComplete="off"
            className={cn(fieldControl, "font-mono")}
          />
        </FormField>
        <FormField label="Course" htmlFor="person-course" error={errors.course}>
          <SelectField
            id="person-course"
            value={values.course || null}
            options={COURSES.map((course) => ({ value: course, label: course }))}
            onChange={(course) => set("course", course)}
            placeholder="Choose a course"
            invalid={!!errors.course}
          />
        </FormField>
        <FormField label="Year" htmlFor="person-year" error={errors.year}>
          <SelectField<Year>
            id="person-year"
            value={values.year}
            options={YEARS.map((year) => ({ value: year, label: year }))}
            onChange={(year) => set("year", year)}
            placeholder="Choose a year"
            invalid={!!errors.year}
          />
        </FormField>
        <FormField label="Campus" htmlFor="person-campus" error={errors.campus}>
          <SelectField<Campus>
            id="person-campus"
            value={values.campus}
            options={CAMPUSES.map((campus) => ({ value: campus, label: campus }))}
            onChange={(campus) => set("campus", campus)}
            placeholder="Choose a campus"
            invalid={!!errors.campus}
          />
        </FormField>
      </div>
      {person ? null : (
        <label className="mt-4 flex items-start gap-2.5 text-[14px]">
          <Checkbox
            checked={admin}
            onCheckedChange={(checked) => setAdmin(checked === true)}
            className={checkboxControl}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">PoliNetwork admin</span>
            <span className="text-xs text-(--pn-fg-muted)">
              The admin role is managed in PoliNetwork Auth. Add members from the member register and teams from Teams.
            </span>
          </span>
        </label>
      )}
    </FormDialog>
  )
}
