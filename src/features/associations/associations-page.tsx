import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Users } from "lucide-react"
import { useDeferredValue, useState } from "react"

import { buttonMotion, EmptyState, useEditSlot } from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { errorHasCode } from "@/lib/errors"

import { AssociationCard, type AssociationEditSession } from "./association-card"
import { AssociationLinksDialog } from "./association-links-dialog"
import { EMPTY_ASSOCIATION_LINKS } from "./associations.constants"
import { createAssociation, deleteAssociation, editAssociation } from "./associations.functions"
import { associationSaveErrorMessage } from "./associations.validation"
import type { Association, AssociationForm } from "./types"

const DRAFT_ID = -1
const EMPTY_FORM: AssociationForm = { name: "", descriptionIt: "", descriptionEn: "", logo: null, logoFile: null }
const DRAFT: Association = {
  id: DRAFT_ID,
  name: "",
  descriptionIt: "",
  descriptionEn: "",
  logo: null,
  links: EMPTY_ASSOCIATION_LINKS,
}

function formOf({ name, descriptionIt, descriptionEn, logo }: Association): AssociationForm {
  return { name, descriptionIt, descriptionEn, logo, logoFile: null }
}

function sameForm(a: AssociationForm, b: AssociationForm) {
  return (
    a.name === b.name && a.descriptionIt === b.descriptionIt && a.descriptionEn === b.descriptionEn && a.logo === b.logo
  )
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
}

/** The multipart body `createAssociation`/`editAssociation` validate; the logo is sent only when a new file was chosen. */
function associationFormData(values: AssociationForm, id?: number) {
  const data = new FormData()
  if (id !== undefined) data.set("id", String(id))
  data.set("name", values.name.trim())
  data.set("descriptionIt", values.descriptionIt.trim())
  data.set("descriptionEn", values.descriptionEn.trim())
  if (values.logoFile) data.set("logo", values.logoFile)
  return data
}

/** Associations: searchable inline-edit cards, a draft on top, links in a dialog. */
export function AssociationsPage({ loadedAssociations: associations }: { loadedAssociations: Association[] }) {
  const router = useRouter()
  const canWrite = useCan("web:content:write")
  const createAssociationFn = useServerFn(createAssociation)
  const editAssociationFn = useServerFn(editAssociation)
  const deleteAssociationFn = useServerFn(deleteAssociation)

  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [links, setLinks] = useState<{ id: number; open: boolean; opened: number }>({ id: 0, open: false, opened: 0 })

  const [saving, setSaving] = useState(false)
  const slot = useEditSlot<number>("association", saving)
  const [form, setForm] = useState<AssociationForm | null>(null)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [sessionFor, setSessionFor] = useState<number | null>(null)
  if (sessionFor !== slot.editingId) {
    setSessionFor(slot.editingId)
    setForm(null)
    setSaveError(undefined)
    setLogoError(null)
  }

  const editingDraft = slot.editingId === DRAFT_ID
  const editingAssociation = associations.find((association) => association.id === slot.editingId)
  const initial = editingAssociation ? formOf(editingAssociation) : EMPTY_FORM
  const values = form ?? initial
  const dirty = slot.editingId !== null && !sameForm(values, initial)
  const valid =
    values.name.trim() !== "" &&
    values.descriptionIt.trim() !== "" &&
    values.descriptionEn.trim() !== "" &&
    logoError === null

  const needle = normalize(deferredQuery.trim())
  const matches = needle
    ? associations.filter((association) =>
        [association.name, association.descriptionIt, association.descriptionEn].some((text) =>
          normalize(text).includes(needle)
        )
      )
    : associations
  const cards = editingDraft ? [DRAFT, ...matches] : matches

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning("Your change was saved, but the association list could not be refreshed.")
    }
  }

  async function saveEdit() {
    if (!valid || saving || slot.editingId === null) return
    setSaving(true)
    setSaveError(undefined)
    try {
      if (editingDraft) await createAssociationFn({ data: associationFormData(values) })
      else if (editingAssociation) {
        await editAssociationFn({ data: associationFormData(values, editingAssociation.id) })
      }
      await refresh()
      appToast.success(editingDraft ? "Association added." : "Association updated.")
      slot.stop()
    } catch (error) {
      console.error(error)
      setSaveError(associationSaveErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const session: AssociationEditSession = {
    values,
    onChange: setForm,
    dirty,
    valid,
    saving,
    error: saveError,
    message: logoError ?? undefined,
    onSave: () => void saveEdit(),
    onCancel: slot.stop,
    onLogoError: setLogoError,
  }

  async function removeAssociation(association: Association) {
    try {
      await deleteAssociationFn({ data: { id: association.id } })
    } catch (error) {
      console.error(error)
      // Already gone: the outcome the user asked for.
      if (!errorHasCode(error, "NOT_FOUND")) {
        throw new Error("Couldn't delete the association. Check your permissions and try again.", { cause: error })
      }
    }
    await refresh()
    appToast.success("Association deleted.")
  }

  function addAssociation() {
    if (!editingDraft) slot.start(DRAFT_ID, dirty)
  }

  const linksAssociation = associations.find((association) => association.id === links.id) ?? null

  const addButton = (
    <Button size="sm" onClick={addAssociation} className={buttonMotion}>
      <Plus data-icon="inline-start" />
      Add association
    </Button>
  )

  let content
  if (cards.length > 0) {
    content = (
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((association) => (
          <AssociationCard
            key={association.id}
            association={association}
            draft={association.id === DRAFT_ID}
            canWrite={canWrite}
            session={slot.editingId === association.id ? session : null}
            onEdit={() => slot.start(association.id, dirty)}
            onDelete={() => removeAssociation(association)}
            onManageLinks={() =>
              setLinks((current) => ({ id: association.id, open: true, opened: current.opened + 1 }))
            }
          />
        ))}
      </div>
    )
  } else if (needle) {
    content = (
      <EmptyState
        icon={Users}
        title="No associations match"
        text="Try a different name or description."
        action={
          <Button size="sm" variant="ghost" onClick={() => setQuery("")} className={buttonMotion}>
            Clear search
          </Button>
        }
      />
    )
  } else {
    content = (
      <EmptyState
        icon={Users}
        title="No associations yet"
        text="Add the first association shown on the public website."
        action={
          canWrite ? (
            <Button size="sm" variant="outline" onClick={addAssociation} className={buttonMotion}>
              <Plus data-icon="inline-start" />
              Add association
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery, placeholder: "Search associations…" }}
            count={
              needle ? (
                <Count value={matches.length} total={associations.length} noun="association" />
              ) : (
                <Count value={associations.length} noun="association" />
              )
            }
          />
        }
        right={canWrite ? addButton : undefined}
      />
      <PageContent width="wide">
        {slot.discardDialog}
        {content}
        <AssociationLinksDialog
          key={links.opened}
          association={linksAssociation}
          open={links.open && linksAssociation !== null}
          onOpenChange={(open) => setLinks((current) => ({ ...current, open }))}
          onSaved={async () => {
            await refresh()
            appToast.success("Links updated.")
          }}
        />
      </PageContent>
    </>
  )
}
