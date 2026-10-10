import { DragDropProvider, type DragEndEvent, useDragDropManager } from "@dnd-kit/react"
import { isSortable } from "@dnd-kit/react/sortable"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { FolderKanban, Plus } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { buttonMotion, EmptyState, SegmentedControl, useEditSlot } from "@/components/primitives"
import { appToast, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { ProjectCard, type ProjectEditSession } from "./project-card"
import { getProjectCategoryLabel, PROJECT_CATEGORIES } from "./projects.constants"
import { createProject, deleteProject, editProject, reorderProjects } from "./projects.functions"
import { projectSaveErrorMessage } from "./projects.validation"
import type { Project, ProjectCategory, ProjectForm } from "./types"

const DRAFT_ID = -1
const EMPTY_FORM: ProjectForm = {
  title: "",
  link: "",
  descriptionIt: "",
  descriptionEn: "",
  logo: null,
  logoFile: null,
}
const LINK_ERROR = "Enter a valid HTTP or HTTPS project URL."
const ORDER_ERROR = "Couldn't save the project order."

function formOf({ title, descriptionIt, descriptionEn, logo, link }: Project): ProjectForm {
  return { title, descriptionIt, descriptionEn, logo, link: link ?? "", logoFile: null }
}

function sameForm(a: ProjectForm, b: ProjectForm) {
  return (
    a.title === b.title &&
    a.link === b.link &&
    a.descriptionIt === b.descriptionIt &&
    a.descriptionEn === b.descriptionEn &&
    a.logo === b.logo
  )
}

function isHttpUrl(value: string) {
  if (!URL.canParse(value)) return false
  const { protocol } = new URL(value)
  return protocol === "http:" || protocol === "https:"
}

/** The multipart body `createProject`/`editProject` validate; the logo is sent only when a new file was chosen. */
function projectFormData(values: ProjectForm, category: ProjectCategory, id?: number) {
  const data = new FormData()
  if (id !== undefined) data.set("id", String(id))
  data.set("title", values.title.trim())
  data.set("descriptionIt", values.descriptionIt.trim())
  data.set("descriptionEn", values.descriptionEn.trim())
  data.set("link", values.link.trim())
  data.set("category", category)
  if (values.logoFile) data.set("logoFile", values.logoFile)
  return data
}

/** `projects` with the active category's cards in `ordered`'s order, everything else in place. */
function withCategoryOrder(projects: Project[], category: ProjectCategory, ordered: Project[]) {
  let next = 0
  return projects.map((project) => (project.category === category ? (ordered[next++] ?? project) : project))
}

function noop() {}

/** Settles the drop with 200ms ease-out; reduced motion drops in place. */
function DropSettle() {
  const manager = useDragDropManager()
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    for (const plugin of manager?.plugins ?? []) {
      if ("dropAnimation" in plugin) {
        plugin.dropAnimation = reduceMotion ? null : { duration: 200, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
      }
    }
  }, [manager, reduceMotion])
  return null
}

/** Projects: category segments, sortable inline-edit cards, drafts on top. */
export function ProjectsPage({ loadedProjects }: { loadedProjects: Project[] }) {
  const router = useRouter()
  const canWrite = useCan("web:content:write")
  const createProjectFn = useServerFn(createProject)
  const editProjectFn = useServerFn(editProject)
  const deleteProjectFn = useServerFn(deleteProject)
  const reorderProjectsFn = useServerFn(reorderProjects)

  const [category, setCategory] = useState<ProjectCategory>("general")
  const [draftCategory, setDraftCategory] = useState<ProjectCategory>("general")
  // Order shown while a reorder is saving; cleared (back to the loader data) once it settles.
  const [optimistic, setOptimistic] = useState<Project[] | null>(null)
  const reorderRequest = useRef(0)
  const reorderQueue = useRef<Promise<unknown>>(Promise.resolve())
  const projects = optimistic ?? loadedProjects

  const [saving, setSaving] = useState(false)
  const slot = useEditSlot<number>("project", saving)
  const [form, setForm] = useState<ProjectForm | null>(null)
  const [saveError, setSaveError] = useState<string | undefined>(undefined)
  // The link is validated on the first Save attempt, then again on blur once it has errored.
  const [linkErrored, setLinkErrored] = useState(false)
  const [linkError, setLinkError] = useState<string | undefined>(undefined)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [sessionFor, setSessionFor] = useState<number | null>(null)
  if (sessionFor !== slot.editingId) {
    setSessionFor(slot.editingId)
    setForm(null)
    setSaveError(undefined)
    setLinkErrored(false)
    setLinkError(undefined)
    setLogoError(null)
  }

  const editingDraft = slot.editingId === DRAFT_ID
  const editingProject = projects.find((project) => project.id === slot.editingId)
  const initial = editingProject ? formOf(editingProject) : EMPTY_FORM
  const values = form ?? initial
  const dirty = slot.editingId !== null && !sameForm(values, initial)
  const linkInvalid = values.link.trim() !== "" && !isHttpUrl(values.link.trim())
  const valid =
    values.title.trim() !== "" &&
    values.descriptionIt.trim() !== "" &&
    values.descriptionEn.trim() !== "" &&
    logoError === null

  const draft: Project = { id: DRAFT_ID, ...EMPTY_FORM, link: null, category: draftCategory }
  const inCategory = projects.filter((project) => project.category === category)
  const cards = editingDraft && draftCategory === category ? [draft, ...inCategory] : inCategory

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning("Your change was saved, but the latest project list could not be refreshed.")
    }
  }

  /** Reorders run one at a time, in the order they were made. */
  function enqueueReorder(projectIds: number[]) {
    const operation = reorderQueue.current.then(() => reorderProjectsFn({ data: { projectIds } }))
    // The caller handles the failure; the queue only needs to know it settled.
    reorderQueue.current = operation.then(noop, noop)
    return operation
  }

  function startEdit(id: number) {
    slot.start(id, dirty)
  }

  function addProject() {
    if (saving) return
    setDraftCategory(category)
    if (!editingDraft) startEdit(DRAFT_ID)
  }

  /** Creates the draft, then keeps it first in its category, where it was shown while editing. */
  async function create() {
    const saved = await createProjectFn({ data: projectFormData(values, draftCategory) })
    const below = projects.filter((project) => project.category === saved.category && project.id !== saved.id)
    if (below.length === 0) return true
    try {
      await enqueueReorder([saved.id, ...below.map((project) => project.id)])
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  async function saveEdit() {
    if (!valid || saving || slot.editingId === null) return
    if (linkInvalid) {
      setLinkErrored(true)
      setLinkError(LINK_ERROR)
      return
    }
    setSaving(true)
    setSaveError(undefined)
    try {
      if (editingDraft) {
        const ordered = await create()
        await refresh()
        if (ordered) appToast.success("Project added.")
        else appToast.warning("Project added, but its position couldn't be saved.")
      } else if (editingProject) {
        await editProjectFn({ data: projectFormData(values, editingProject.category, editingProject.id) })
        await refresh()
        appToast.success("Project updated.")
      }
      slot.stop()
    } catch (error) {
      console.error(error)
      setSaveError(projectSaveErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const session: ProjectEditSession = {
    values,
    onChange: setForm,
    dirty,
    valid,
    saving,
    error: saveError,
    message: logoError ?? undefined,
    linkError,
    onSave: () => void saveEdit(),
    onCancel: slot.stop,
    onLinkBlur: () => {
      if (linkErrored) setLinkError(linkInvalid ? LINK_ERROR : undefined)
    },
    onLogoError: setLogoError,
  }

  async function moveProject(project: Project, target: ProjectCategory) {
    try {
      await editProjectFn({ data: projectFormData(formOf(project), target, project.id) })
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't move the project.")
      return
    }
    const moved = projects.map((item) => (item.id === project.id ? { ...item, category: target } : item))
    const ordered = await persistCategoryOrders(moved, [project.category, target])
    await refresh()
    if (ordered) appToast.success(`Project moved to ${getProjectCategoryLabel(target)}.`)
    else appToast.warning("Project moved, but its category order couldn't be saved.")
  }

  async function removeProject(project: Project) {
    try {
      await deleteProjectFn({ data: { id: project.id } })
    } catch (error) {
      console.error(error)
      throw new Error("Couldn't delete the project. Check your permissions and try again.", { cause: error })
    }
    const ordered = await persistCategoryOrders(
      projects.filter((item) => item.id !== project.id),
      [project.category]
    )
    await refresh()
    if (ordered) appToast.success("Project deleted.")
    else appToast.warning("Project deleted, but the remaining order couldn't be saved.")
  }

  async function persistCategoryOrders(items: Project[], categories: ProjectCategory[]) {
    try {
      for (const category of categories) {
        const ids = items.filter((item) => item.category === category).map((item) => item.id)
        if (ids.length > 1) await enqueueReorder(ids)
      }
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { source } = event.operation
    if (event.canceled || !source || !isSortable(source)) return
    const { initialIndex, index } = source
    if (initialIndex === index) return

    const ordered = [...cards]
    const [moved] = ordered.splice(initialIndex, 1)
    if (!moved) return
    ordered.splice(index, 0, moved)
    const saved = ordered.filter((project) => project.id !== DRAFT_ID)
    if (saved.length < 2) return

    const request = reorderRequest.current + 1
    reorderRequest.current = request
    flushSync(() => setOptimistic(withCategoryOrder(projects, category, saved)))
    void saveOrder(
      saved.map((project) => project.id),
      request
    )
  }

  /** Persists a dragged order; only the latest drag clears the optimistic order or reverts it. */
  async function saveOrder(projectIds: number[], request: number) {
    try {
      await enqueueReorder(projectIds)
    } catch (error) {
      console.error(error)
      if (reorderRequest.current !== request) return
      setOptimistic(null)
      appToast.error(ORDER_ERROR)
      void refresh()
      return
    }
    if (reorderRequest.current !== request) return
    await refresh()
    if (reorderRequest.current === request) setOptimistic(null)
  }

  const segments = (
    <SegmentedControl
      label="Project category"
      items={PROJECT_CATEGORIES.map((item) => ({
        value: item.value,
        label: item.label,
        count: projects.filter((project) => project.category === item.value).length,
      }))}
      value={category}
      onValueChange={setCategory}
    />
  )

  const addButton = (
    <Button size="sm" onClick={addProject} className={buttonMotion}>
      <Plus data-icon="inline-start" />
      Add project
    </Button>
  )

  return (
    <>
      <PageBar left={<Toolbar filters={segments} />} right={canWrite ? addButton : undefined} />
      <PageContent width="wide">
        {slot.discardDialog}
        {cards.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={`No ${getProjectCategoryLabel(category).toLowerCase()} projects yet`}
            text="Add a project here or pick another category."
            action={
              canWrite ? (
                <Button size="sm" variant="outline" onClick={addProject} className={buttonMotion}>
                  <Plus data-icon="inline-start" />
                  Add project
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DragDropProvider onDragEnd={handleDragEnd}>
            <DropSettle />
            <div className="flex flex-col gap-4">
              {cards.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  draft={project.id === DRAFT_ID}
                  canWrite={canWrite}
                  session={slot.editingId === project.id ? session : null}
                  onEdit={() => startEdit(project.id)}
                  onMove={(target) => moveProject(project, target)}
                  onDelete={() => removeProject(project)}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </PageContent>
    </>
  )
}
