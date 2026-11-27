import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"

import { fieldControl, fieldHintId, FormDialog, FormField, Hint } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { ACKNOWLEDGEMENT_ICON_MAP } from "./acknowledgement-icon"
import {
  createAcknowledgement,
  createAcknowledgementGroup,
  updateAcknowledgement,
  updateAcknowledgementGroup,
} from "./acknowledgements.functions"
import {
  ACKNOWLEDGEMENT_DETAIL_MAX_LENGTH,
  ACKNOWLEDGEMENT_ICONS,
  ACKNOWLEDGEMENT_NAME_MAX_LENGTH,
  ACKNOWLEDGEMENT_TITLE_MAX_LENGTH,
  acknowledgementGroupInput,
  acknowledgementInput,
  acknowledgementsErrorMessage,
  fieldErrors,
} from "./acknowledgements.validation"
import type { Acknowledgement, AcknowledgementGroup, AcknowledgementIconName, AcknowledgementList } from "./types"

const ARROW_STEPS = new Map([
  ["ArrowRight", 1],
  ["ArrowDown", 1],
  ["ArrowLeft", -1],
  ["ArrowUp", -1],
])

type IconPickerProps = { value: AcknowledgementIconName; onChange: (icon: AcknowledgementIconName) => void }

/** The group's icon as a radio group: one button per icon, arrows move the choice. */
function IconPicker({ value, onChange }: IconPickerProps) {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] leading-5 font-medium text-(--pn-fg)">
        Icona
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex w-fit flex-wrap gap-1">
        {ACKNOWLEDGEMENT_ICONS.map((name) => {
          const { icon: Icon, label } = ACKNOWLEDGEMENT_ICON_MAP[name]
          const selected = name === value
          return (
            <Hint key={name} label={label}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(name)}
                onKeyDown={(event) => {
                  const step = ARROW_STEPS.get(event.key)
                  if (step === undefined) return
                  event.preventDefault()
                  const index = ACKNOWLEDGEMENT_ICONS.indexOf(name) + step
                  const next =
                    ACKNOWLEDGEMENT_ICONS[(index + ACKNOWLEDGEMENT_ICONS.length) % ACKNOWLEDGEMENT_ICONS.length]
                  if (next) onChange(next)
                  const group = event.currentTarget.parentElement
                  requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())
                }}
                className={cn(
                  "grid size-9 place-items-center rounded-(--pn-r-3) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-hover) hover:text-(--pn-fg)",
                  selected &&
                    "bg-(--pn-accent-soft) text-(--pn-accent) ring-1 ring-(--pn-accent) ring-inset hover:bg-(--pn-accent-soft-hover) hover:text-(--pn-accent)"
                )}
              >
                <Icon aria-hidden strokeWidth={1.75} className="size-4" />
              </button>
            </Hint>
          )
        })}
      </div>
    </div>
  )
}

type GroupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this group; `null` creates one. Mount with a fresh `key` per opening. */
  group: AcknowledgementGroup | null
  /** Reloads the route; runs before the dialog closes, with the saved group's id. */
  onSaved: (groupId: number) => Promise<void>
}

/** "Nuovo gruppo" / "Modifica gruppo": the icon and the title shown above the group's people. */
export function AcknowledgementGroupDialog({ open, onOpenChange, group, onSaved }: GroupDialogProps) {
  const createFn = useServerFn(createAcknowledgementGroup)
  const updateFn = useServerFn(updateAcknowledgementGroup)
  const titleId = useId()
  const initialIcon: AcknowledgementIconName = group?.icon ?? "smile"
  const initialTitle = group?.title ?? ""
  const [icon, setIcon] = useState<AcknowledgementIconName>(initialIcon)
  const [title, setTitle] = useState(initialTitle)
  const [titleError, setTitleError] = useState<string | undefined>(undefined)
  const dirty = icon !== initialIcon || title !== initialTitle

  async function submit() {
    const parsed = acknowledgementGroupInput.safeParse({ title, icon })
    if (!parsed.success) {
      setTitleError(fieldErrors(parsed.error, ["title"] as const).title)
      document.getElementById(titleId)?.focus()
      return
    }
    setTitleError(undefined)
    let groupId: number
    try {
      groupId = group
        ? (await updateFn({ data: { id: group.id, ...parsed.data } })).id
        : (await createFn({ data: parsed.data })).id
    } catch (error) {
      console.error(error)
      throw new Error(
        acknowledgementsErrorMessage(
          error,
          group ? "Non è stato possibile salvare il gruppo." : "Non è stato possibile creare il gruppo."
        )
      )
    }
    await onSaved(groupId)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      locale="it"
      title={group ? "Modifica gruppo" : "Nuovo gruppo"}
      description="I gruppi dividono per ruolo chi ha realizzato il nuovo sito, nella pagina Ringraziamenti."
      noun="il gruppo"
      dirty={dirty}
      submitLabel={group ? "Salva modifiche" : "Crea gruppo"}
      canSubmit={group === null || dirty}
      onSubmit={submit}
    >
      <IconPicker value={icon} onChange={setIcon} />
      <FormField
        label="Titolo"
        htmlFor={titleId}
        error={titleError}
        counter={{ length: title.length, max: ACKNOWLEDGEMENT_TITLE_MAX_LENGTH }}
      >
        <Input
          id={titleId}
          value={title}
          maxLength={ACKNOWLEDGEMENT_TITLE_MAX_LENGTH}
          placeholder="Ad esempio Designer, Developer…"
          autoComplete="off"
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? fieldHintId(titleId) : undefined}
          className={cn("h-9 px-3", fieldControl)}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormField>
    </FormDialog>
  )
}

const ENTRY_FIELDS = ["name", "detail"] as const
type EntryErrors = Partial<Record<(typeof ENTRY_FIELDS)[number], string>>

type EntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this person; `null` adds one at the end of `list`. Mount with a fresh `key` per opening. */
  entry: Acknowledgement | null
  list: AcknowledgementList
  /** The group's title, to name where a website person is added. */
  groupTitle?: string
  /** Reloads the route; runs before the dialog closes. */
  onSaved: () => Promise<void>
  /** Where focus goes on close. */
  finalFocus?: () => HTMLElement | null
}

/** "Aggiungi persona" / "Modifica persona": the name and the label under it (a role, or the project). */
export function AcknowledgementDialog({
  open,
  onOpenChange,
  entry,
  list,
  groupTitle,
  onSaved,
  finalFocus,
}: EntryDialogProps) {
  const createFn = useServerFn(createAcknowledgement)
  const updateFn = useServerFn(updateAcknowledgement)
  const prefix = useId()
  const id = (field: string) => `${prefix}-${field}`
  const initial = { name: entry?.name ?? "", detail: entry?.detail ?? "" }
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<EntryErrors>({})
  const dirty = values.name !== initial.name || values.detail !== initial.detail
  const projects = list.section === "projects"

  async function submit() {
    const parsed = acknowledgementInput.safeParse({ list, ...values })
    if (!parsed.success) {
      const next = fieldErrors(parsed.error, ENTRY_FIELDS)
      setErrors(next)
      const first = ENTRY_FIELDS.find((field) => next[field])
      if (first) document.getElementById(id(first))?.focus()
      return
    }
    setErrors({})
    const { name, detail } = parsed.data
    try {
      if (entry) await updateFn({ data: { id: entry.id, name, detail } })
      else await createFn({ data: parsed.data })
    } catch (error) {
      console.error(error)
      throw new Error(
        acknowledgementsErrorMessage(
          error,
          entry ? "Non è stato possibile salvare la persona." : "Non è stato possibile aggiungere la persona."
        )
      )
    }
    await onSaved()
    onOpenChange(false)
  }

  const where = projects ? "ai progetti di PoliNetwork" : groupTitle ? `al gruppo ${groupTitle}` : "al gruppo"

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={finalFocus}
      locale="it"
      title={entry ? "Modifica persona" : "Aggiungi persona"}
      description={entry ? undefined : `Viene aggiunta in fondo ${where}.`}
      noun="la persona"
      dirty={dirty}
      submitLabel={entry ? "Salva modifiche" : "Aggiungi"}
      canSubmit={entry === null || dirty}
      onSubmit={submit}
    >
      <FormField
        label="Nome"
        htmlFor={id("name")}
        error={errors.name}
        counter={{ length: values.name.length, max: ACKNOWLEDGEMENT_NAME_MAX_LENGTH }}
      >
        <Input
          id={id("name")}
          value={values.name}
          maxLength={ACKNOWLEDGEMENT_NAME_MAX_LENGTH}
          placeholder="Nome e cognome"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? fieldHintId(id("name")) : undefined}
          className={cn("h-9 px-3", fieldControl)}
          onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
        />
      </FormField>
      <FormField
        label={projects ? "Progetto (facoltativo)" : "Dettaglio (facoltativo)"}
        htmlFor={id("detail")}
        error={errors.detail}
        hint={
          projects
            ? "Il progetto a cui ha contribuito, mostrato sotto il nome."
            : "Mostrato in maiuscolo sotto il nome, ad esempio Responsabile o Backend."
        }
        counter={{ length: values.detail.length, max: ACKNOWLEDGEMENT_DETAIL_MAX_LENGTH }}
      >
        <Input
          id={id("detail")}
          value={values.detail}
          maxLength={ACKNOWLEDGEMENT_DETAIL_MAX_LENGTH}
          placeholder={projects ? "Ad esempio PoliAule" : "Ad esempio Design system"}
          autoComplete="off"
          aria-invalid={errors.detail ? true : undefined}
          aria-describedby={fieldHintId(id("detail"))}
          className={cn("h-9 px-3", fieldControl)}
          onChange={(event) => setValues((current) => ({ ...current, detail: event.target.value }))}
        />
      </FormField>
    </FormDialog>
  )
}
