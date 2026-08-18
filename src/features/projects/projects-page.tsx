import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { FolderKanban, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "./project-card"
import { DEFAULT_PROJECT, PROJECT_CATEGORIES } from "./projects.constants"
import { createProject, deleteProject, editProject, reorderProjects } from "./projects.functions"
import type { Project, ProjectCategory, ProjectFormValues, ProjectReorder } from "./types"

function formDataForProject(values: ProjectFormValues, id?: number) {
  const data = new FormData()
  if (id !== undefined) data.set("id", String(id))
  data.set("title", values.title)
  data.set("descriptionIt", values.descriptionIt)
  data.set("descriptionEn", values.descriptionEn)
  data.set("link", values.link ?? "")
  data.set("logo", values.logo ?? "")
  data.set("category", values.category)
  if (values.logoFile) data.set("logoFile", values.logoFile)
  return data
}

function moveProjectInCategory(items: Project[], category: ProjectCategory, sourceIndex: number, targetIndex: number) {
  const categoryProjects = items.filter((project) => project.category === category)
  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= categoryProjects.length ||
    targetIndex >= categoryProjects.length
  ) {
    return null
  }

  const reorderedCategory = [...categoryProjects]
  const [movedProject] = reorderedCategory.splice(sourceIndex, 1)
  if (!movedProject) return null
  reorderedCategory.splice(targetIndex, 0, movedProject)

  let categoryIndex = 0
  const nextProjects = items.map((project) => {
    if (project.category !== category) return project
    return reorderedCategory[categoryIndex++] ?? project
  })

  return { nextProjects, orderedIds: reorderedCategory.map((project) => project.id) }
}

export function ProjectsPage({ loadedProjects }: { loadedProjects: Project[] }) {
  const router = useRouter()
  const createProjectFn = useServerFn(createProject)
  const editProjectFn = useServerFn(editProject)
  const deleteProjectFn = useServerFn(deleteProject)
  const reorderProjectsFn = useServerFn(reorderProjects)
  const [projects, setProjects] = useState(loadedProjects)
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>(DEFAULT_PROJECT.category)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [draftProjectIds, setDraftProjectIds] = useState<Set<number>>(new Set())
  const reorderRequestId = useRef(0)

  useEffect(() => setProjects(loadedProjects), [loadedProjects])

  const visibleProjects = projects.filter((project) => project.category === activeCategory)

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch {
      toast.warning("Your change was saved, but the latest project list could not be refreshed.")
    }
  }

  function persistedIds(items: Project[], category: ProjectCategory) {
    return items
      .filter((project) => project.category === category && !draftProjectIds.has(project.id))
      .map((project) => project.id)
  }

  async function persistOrder(projectIds: number[], rollback: Project[], requestId: number) {
    if (projectIds.length < 2) return true
    try {
      await reorderProjectsFn({ data: { projectIds } })
      if (reorderRequestId.current === requestId) void refresh()
      return true
    } catch {
      if (reorderRequestId.current === requestId) {
        setProjects(rollback)
        toast.error("The project order could not be saved.")
      }
      return false
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled) return
    const source = event.operation.source
    if (
      !source ||
      !("initialIndex" in source) ||
      !("index" in source) ||
      typeof source.initialIndex !== "number" ||
      typeof source.index !== "number"
    ) {
      return
    }

    const reordered = moveProjectInCategory(projects, activeCategory, source.initialIndex, source.index)
    if (!reordered) return
    const change: ProjectReorder = { ...reordered, previousProjects: projects }
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId

    flushSync(() => setProjects(change.nextProjects))
    const ids = change.orderedIds.filter((id) => !draftProjectIds.has(id))
    void persistOrder(ids, change.previousProjects, requestId)
  }

  function addProject() {
    const draft: Project = { ...DEFAULT_PROJECT, id: -Date.now(), category: activeCategory }
    setProjects((current) => [draft, ...current])
    setDraftProjectIds((current) => new Set(current).add(draft.id))
    setEditingProjectId(draft.id)
  }

  function cancelDraft(id: number) {
    setProjects((current) => current.filter((project) => project.id !== id))
    setDraftProjectIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setEditingProjectId((current) => (current === id ? null : current))
  }

  async function saveProject(id: number, values: ProjectFormValues) {
    const draft = draftProjectIds.has(id)
    try {
      const saved = draft
        ? await createProjectFn({ data: formDataForProject(values) })
        : await editProjectFn({ data: formDataForProject(values, id) })
      const nextProjects = projects.map((project) => (project.id === id ? saved : project))
      const nextDraftIds = new Set(draftProjectIds)
      nextDraftIds.delete(id)

      setProjects(nextProjects)
      setDraftProjectIds(nextDraftIds)
      setEditingProjectId((current) => (current === id ? null : current))
      toast.success(`Project ${draft ? "created" : "updated"}.`)

      if (draft) {
        const requestId = reorderRequestId.current + 1
        reorderRequestId.current = requestId
        const ids = nextProjects
          .filter((project) => project.category === saved.category && !nextDraftIds.has(project.id))
          .map((project) => project.id)
        await persistOrder(ids, nextProjects, requestId)
      } else {
        void refresh()
      }
      return true
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      toast.error(
        message.includes("LOGO_TOO_LARGE")
          ? "The logo must be no larger than 1 MB."
          : message.includes("INVALID_LOGO_TYPE")
            ? "Choose an SVG, PNG, or JPEG logo."
            : "The project could not be saved. Check the fields and try again."
      )
      return false
    }
  }

  async function removeProject(id: number) {
    if (draftProjectIds.has(id)) {
      cancelDraft(id)
      return true
    }

    const previousProjects = projects
    const project = projects.find((item) => item.id === id)
    if (!project) return false
    const nextProjects = projects.filter((item) => item.id !== id)
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId
    setProjects(nextProjects)

    try {
      await deleteProjectFn({ data: { id } })
      toast.success("Project deleted.")
      const ids = persistedIds(nextProjects, project.category)
      if (ids.length > 1) await persistOrder(ids, nextProjects, requestId)
      else void refresh()
      return true
    } catch {
      if (reorderRequestId.current === requestId) setProjects(previousProjects)
      toast.error("The project could not be deleted. Check your permissions and try again.")
      return false
    }
  }

  async function changeCategory(id: number, category: ProjectCategory) {
    const project = projects.find((item) => item.id === id)
    if (!project || project.category === category) return

    const previousProjects = projects
    const movedProject = { ...project, category }
    const nextProjects = projects.map((item) => (item.id === id ? movedProject : item))
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId
    setProjects(nextProjects)
    setActiveCategory(category)

    if (draftProjectIds.has(id)) return

    try {
      const saved = await editProjectFn({ data: formDataForProject(movedProject, id) })
      const savedProjects = nextProjects.map((item) => (item.id === id ? saved : item))
      setProjects(savedProjects)
      toast.success("Project moved.")
      const ids = persistedIds(savedProjects, category)
      if (ids.length > 1) await persistOrder(ids, savedProjects, requestId)
      else void refresh()
    } catch {
      if (reorderRequestId.current === requestId) {
        setProjects(previousProjects)
        setActiveCategory(project.category)
      }
      toast.error("The project could not be moved.")
    }
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Projects"
        description="Manage the projects displayed across the public web platform."
        count={visibleProjects.length}
        total={projects.length}
        action={
          <Button onClick={addProject}>
            <Plus data-icon="inline-start" /> Add project
          </Button>
        }
      >
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Project categories">
          {PROJECT_CATEGORIES.map((category) => (
            <Button
              key={category.value}
              type="button"
              size="sm"
              variant={activeCategory === category.value ? "secondary" : "ghost"}
              role="tab"
              aria-selected={activeCategory === category.value}
              onClick={() => setActiveCategory(category.value)}
            >
              {category.label}
              <span className="ml-1 text-xs text-muted-foreground">
                {projects.filter((project) => project.category === category.value).length}
              </span>
            </Button>
          ))}
        </div>
      </DataToolbar>

      {visibleProjects.length ? (
        <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {visibleProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                draft={draftProjectIds.has(project.id)}
                initialEditActive={editingProjectId === project.id}
                sortableIndex={index}
                onCancelDraft={() => cancelDraft(project.id)}
                onDelete={() => removeProject(project.id)}
                onCategoryChange={(category) => changeCategory(project.id, category)}
                onSave={(values) => saveProject(project.id, values)}
              />
            ))}
          </div>
        </DragDropProvider>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title={`No ${activeCategory} projects yet`}
          text="Add the first project in this category, or choose another category above."
          action={<Button onClick={addProject}>Add project</Button>}
        />
      )}
    </div>
  )
}
