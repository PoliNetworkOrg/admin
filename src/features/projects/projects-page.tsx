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
import { DEFAULT_PROJECT, getProjectCategoryLabel, PROJECT_CATEGORIES } from "./projects.constants"
import { createProject, deleteProject, editProject, reorderProjects } from "./projects.functions"
import { projectSaveErrorMessage } from "./projects.validation"
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
  const draftProjectIdsRef = useRef(draftProjectIds)
  const reorderRequestId = useRef(0)
  const reorderQueue = useRef<Promise<void>>(Promise.resolve())
  draftProjectIdsRef.current = draftProjectIds

  useEffect(() => {
    setProjects((current) => {
      const drafts = current.filter((project) => draftProjectIdsRef.current.has(project.id))
      return drafts.length ? [...drafts, ...loadedProjects] : loadedProjects
    })
  }, [loadedProjects])

  const visibleProjects = projects.filter((project) => project.category === activeCategory)

  async function refresh() {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.warning("Your change was saved, but the latest project list could not be refreshed.")
    }
  }

  function persistedIds(items: Project[], category: ProjectCategory, draftIds = draftProjectIdsRef.current) {
    return items
      .filter((project) => project.category === category && !draftIds.has(project.id))
      .map((project) => project.id)
  }

  async function persistOrders(projectIdGroups: number[][], rollback: Project[], requestId: number) {
    const groups = projectIdGroups.filter((projectIds) => projectIds.length > 1)
    if (!groups.length) {
      if (reorderRequestId.current === requestId) void refresh()
      return true
    }

    const operation = reorderQueue.current.then(async () => {
      for (const projectIds of groups) await reorderProjectsFn({ data: { projectIds } })
    })
    reorderQueue.current = operation.then(
      () => undefined,
      () => undefined
    )

    try {
      await operation
      if (reorderRequestId.current === requestId) void refresh()
      return true
    } catch (error) {
      console.error(error)
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
    void persistOrders([ids], change.previousProjects, requestId)
  }

  function addProject() {
    const draft: Project = { ...DEFAULT_PROJECT, id: -Date.now(), category: activeCategory }
    setProjects((current) => [draft, ...current])
    setDraftProjectIds((current) => {
      const next = new Set(current).add(draft.id)
      draftProjectIdsRef.current = next
      return next
    })
    setEditingProjectId(draft.id)
  }

  function cancelDraft(id: number) {
    setProjects((current) => current.filter((project) => project.id !== id))
    setDraftProjectIds((current) => {
      const next = new Set(current)
      next.delete(id)
      draftProjectIdsRef.current = next
      return next
    })
    setEditingProjectId((current) => (current === id ? null : current))
  }

  async function saveProject(id: number, values: ProjectFormValues) {
    const draft = draftProjectIdsRef.current.has(id)
    try {
      const saved = draft
        ? await createProjectFn({ data: formDataForProject(values) })
        : await editProjectFn({ data: formDataForProject(values, id) })

      let nextProjects: Project[] = []
      let nextDraftIds = new Set<number>()
      flushSync(() => {
        setProjects((current) => {
          nextProjects = current.map((project) => (project.id === id ? saved : project))
          return nextProjects
        })
        setDraftProjectIds((current) => {
          nextDraftIds = new Set(current)
          nextDraftIds.delete(id)
          draftProjectIdsRef.current = nextDraftIds
          return nextDraftIds
        })
      })
      setEditingProjectId((current) => (current === id ? null : current))
      toast.success(`Project ${draft ? "created" : "updated"}.`)

      if (draft) {
        const requestId = reorderRequestId.current + 1
        reorderRequestId.current = requestId
        const ids = persistedIds(nextProjects, saved.category, nextDraftIds)
        await persistOrders([ids], nextProjects, requestId)
      } else {
        void refresh()
      }
      return true
    } catch (cause) {
      console.error(cause)
      toast.error(projectSaveErrorMessage(cause))
      return false
    }
  }

  async function removeProject(id: number) {
    if (draftProjectIdsRef.current.has(id)) {
      cancelDraft(id)
      return true
    }

    let previousProjects: Project[] = []
    let nextProjects: Project[] = []
    let project: Project | undefined
    flushSync(() => {
      setProjects((current) => {
        previousProjects = current
        project = current.find((item) => item.id === id)
        nextProjects = current.filter((item) => item.id !== id)
        return project ? nextProjects : current
      })
    })
    if (!project) return false
    const removedProject = project
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId

    try {
      await deleteProjectFn({ data: { id } })
      toast.success("Project deleted.")
      const ids = persistedIds(nextProjects, removedProject.category)
      await persistOrders([ids], nextProjects, requestId)
      return true
    } catch (error) {
      console.error(error)
      if (reorderRequestId.current === requestId) {
        setProjects((current) => {
          if (current.some((item) => item.id === id)) return current
          const restored = [...current]
          const previousIndex = previousProjects.findIndex((item) => item.id === id)
          restored.splice(Math.min(Math.max(previousIndex, 0), restored.length), 0, removedProject)
          return restored
        })
      }
      toast.error("The project could not be deleted. Check your permissions and try again.")
      return false
    }
  }

  async function changeCategory(id: number, category: ProjectCategory) {
    let project: Project | undefined
    flushSync(() => {
      setProjects((current) => {
        const foundProject = current.find((item) => item.id === id)
        project = foundProject
        if (!foundProject || foundProject.category === category) return current
        return current.map((item) => (item.id === id ? { ...foundProject, category } : item))
      })
    })
    if (!project || project.category === category) return

    const originalProject = project
    const movedProject = { ...originalProject, category }
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId
    setActiveCategory(category)

    if (draftProjectIdsRef.current.has(id)) return

    try {
      const saved = await editProjectFn({ data: formDataForProject(movedProject, id) })
      let savedProjects: Project[] = []
      flushSync(() => {
        setProjects((current) => {
          savedProjects = current.map((item) => (item.id === id ? saved : item))
          return savedProjects
        })
      })
      toast.success("Project moved.")
      const sourceIds = persistedIds(savedProjects, originalProject.category)
      const destinationIds = persistedIds(savedProjects, category)
      await persistOrders([sourceIds, destinationIds], savedProjects, requestId)
    } catch (error) {
      console.error(error)
      if (reorderRequestId.current === requestId) {
        setProjects((current) =>
          current.map((item) => (item.id === id && item.category === category ? originalProject : item))
        )
        setActiveCategory((current) => (current === category ? originalProject.category : current))
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
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Project categories</legend>
          {PROJECT_CATEGORIES.map((category) => (
            <Button
              key={category.value}
              type="button"
              size="sm"
              variant={activeCategory === category.value ? "secondary" : "ghost"}
              aria-pressed={activeCategory === category.value}
              onClick={() => setActiveCategory(category.value)}
            >
              {category.label}
              <span className="ml-1 text-xs text-muted-foreground">
                {projects.filter((project) => project.category === category.value).length}
              </span>
            </Button>
          ))}
        </fieldset>
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
          title={`No ${getProjectCategoryLabel(activeCategory)} projects yet`}
          text="Add the first project in this category, or choose another category above."
          action={<Button onClick={addProject}>Add project</Button>}
        />
      )}
    </div>
  )
}
