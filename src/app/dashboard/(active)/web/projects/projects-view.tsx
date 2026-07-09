"use client"

import { PlusIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WebHeader from "@/components/web-header"
import { createProject, deleteProject, editProject, reorderProjects } from "@/server/actions/projects"
import { DEFAULT_PROJECT, PROJECT_CATEGORIES } from "./constants"
import { ProjectsDrag } from "./projects-drag"
import type { Project, ProjectCategory, ProjectSaveValues, ProjectsReorder } from "./types"

function getPersistedProjectIds(items: Project[], category: ProjectCategory, draftProjectIds: Set<number>) {
  return items
    .filter((project) => project.category === category)
    .filter((project) => !draftProjectIds.has(project.id))
    .map((project) => project.id)
}

export function ProjectsView({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [draftProjectIds, setDraftProjectIds] = useState<Set<number>>(new Set())
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>(DEFAULT_PROJECT.category)
  // contatore della versione della ultima operazione cosi se arrivano risposte non in ordine o vecchie, non sovrascrivo
  const reorderRequestId = useRef(0)

  // nextProjects é l'ordine nuovo, previous quello vecchio
  function handleProjectsReorder({ nextProjects, orderedIds, previousProjects }: ProjectsReorder) {
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId

    setProjects(nextProjects)

    // aggiorno la ui subito, se é draft non lo considero
    const projectIds = orderedIds.filter((id) => !draftProjectIds.has(id))
    if (projectIds.length < 2) return

    // aspetto che la ui si aggiorni prima di mandare
    window.setTimeout(() => {
      void persistProjectOrder(projectIds, previousProjects, requestId)
    }, 0)
  }

  function restoreProjectSnapshot(rollbackProjects: Project[], requestId: number, activeCategory?: ProjectCategory) {
    if (reorderRequestId.current !== requestId) return false

    setProjects(rollbackProjects)
    if (activeCategory) setActiveCategory(activeCategory)
    return true
  }

  function rollbackProjectOrder(rollbackProjects: Project[], requestId: number, message: string) {
    if (!restoreProjectSnapshot(rollbackProjects, requestId)) return

    toast.error(message)
  }

  async function persistProjectOrder(projectIds: number[], rollbackProjects: Project[], requestId: number) {
    try {
      const result = await reorderProjects({ projectIds })

      if (result.error === "UNAUTHORIZED") {
        rollbackProjectOrder(rollbackProjects, requestId, "You don't have permission to reorder projects.")
        return
      }

      if (result.error) {
        rollbackProjectOrder(rollbackProjects, requestId, "There was an error reordering projects.")
      }
    } catch (_e) {
      rollbackProjectOrder(rollbackProjects, requestId, "There was an error reordering projects.")
    }
  }

  // Creates a new temporary project, id will not be saved and will be replaced
  function handleAdd() {
    const project: Project = {
      ...DEFAULT_PROJECT,
      id: Date.now(),
      category: activeCategory,
    }

    setProjects((items) => [project, ...items])
    setEditingProjectId(project.id)
    setDraftProjectIds((ids) => new Set(ids).add(project.id))
  }

  function removeProjectLocally(id: number) {
    setProjects((items) => items.filter((item) => item.id !== id))
    setDraftProjectIds((ids) => {
      const nextIds = new Set(ids)
      nextIds.delete(id)
      return nextIds
    })
    setEditingProjectId((editingId) => (editingId === id ? null : editingId))
  }

  // remove implica reorder
  async function handleDelete(id: number) {
    if (draftProjectIds.has(id)) {
      removeProjectLocally(id)
      return
    }

    const project = projects.find((item) => item.id === id)
    if (!project) return

    const previousProjects = projects
    const nextProjects = projects.filter((item) => item.id !== id)
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId

    setProjects(nextProjects)
    setEditingProjectId((editingId) => (editingId === id ? null : editingId))

    try {
      const result = await deleteProject(id)
      if (reorderRequestId.current !== requestId) return

      if (result.error === "UNAUTHORIZED") {
        if (restoreProjectSnapshot(previousProjects, requestId)) {
          toast.error("You don't have permission to delete projects.")
        }
        return
      } else if (result.error === "NOT_FOUND") {
        toast.info("This project was already deleted.")
      } else if (result.error) {
        if (restoreProjectSnapshot(previousProjects, requestId)) {
          toast.error("There was an error deleting the project.")
        }
        return
      } else {
        toast.success("Project deleted successfully.")
      }

      const projectIds = getPersistedProjectIds(nextProjects, project.category, draftProjectIds)
      if (projectIds.length > 0) {
        await persistProjectOrder(projectIds, nextProjects, requestId)
      }
    } catch (_e) {
      if (restoreProjectSnapshot(previousProjects, requestId)) {
        toast.error("There was an error deleting the project.")
      }
    }
  }

  async function handleCategoryChange(id: number, category: ProjectCategory) {
    const project = projects.find((item) => item.id === id)
    if (!project || project.category === category) return

    const previousProjects = projects
    const movedProject = { ...project, category }
    const nextProjects = projects.map((item) => (item.id === id ? movedProject : item))
    const requestId = reorderRequestId.current + 1
    reorderRequestId.current = requestId

    setActiveCategory(category)
    setProjects(nextProjects)

    if (draftProjectIds.has(id)) return

    try {
      const result = await editProject(movedProject)
      if (reorderRequestId.current !== requestId) return

      if (result.error === "UNAUTHORIZED") {
        if (restoreProjectSnapshot(previousProjects, requestId, project.category)) {
          toast.error("You don't have permission to move projects.")
        }
        return
      }

      if (result.error === "NOT_FOUND" || !result.project) {
        if (restoreProjectSnapshot(previousProjects, requestId, project.category)) {
          toast.error("There was an error moving the project.")
        }
        return
      }

      const savedProjects = nextProjects.map((item) => (item.id === id ? result.project : item))
      setProjects(savedProjects)
      toast.success("Project moved successfully.")

      const projectIds = getPersistedProjectIds(savedProjects, category, draftProjectIds)
      if (projectIds.length > 0) {
        await persistProjectOrder(projectIds, savedProjects, requestId)
      }
    } catch (_e) {
      if (restoreProjectSnapshot(previousProjects, requestId, project.category)) {
        toast.error("There was an error moving the project.")
      }
    }
  }

  // Draft ne crea una nuova, altrimenti modifica quella esistente
  async function handleSave(id: number, values: ProjectSaveValues) {
    try {
      const isDraft = draftProjectIds.has(id)
      const result = isDraft
        ? await createProject({
            title: values.title,
            logoFile: values.logoFile,
            descriptionIt: values.descriptionIt,
            descriptionEn: values.descriptionEn,
            link: values.link,
            category: values.category,
          })
        : await editProject({
            id,
            title: values.title,
            logoFile: values.logoFile,
            descriptionIt: values.descriptionIt,
            descriptionEn: values.descriptionEn,
            link: values.link,
            category: values.category,
          })

      if (result.error === "UNAUTHORIZED") {
        toast.error("You don't have permission to save projects.")
        return false
      } else if (result.error === "NOT_FOUND") {
        toast.error("This project does not exist anymore.")
        return false
      } else if (!result.project) {
        toast.error("There was an error saving the project.")
        return false
      }

      const savedProjects = projects.map((item) => (item.id === id ? result.project : item))
      const nextDraftProjectIds = new Set(draftProjectIds)
      nextDraftProjectIds.delete(id)

      setProjects(savedProjects)
      setDraftProjectIds(nextDraftProjectIds)
      setEditingProjectId((editingId) => (editingId === id ? null : editingId))
      toast.success(`Project ${isDraft ? "created" : "updated"} successfully.`)

      if (isDraft) {
        const requestId = reorderRequestId.current + 1
        reorderRequestId.current = requestId
        const projectIds = getPersistedProjectIds(savedProjects, result.project.category, nextDraftProjectIds)

        if (projectIds.length > 0) {
          await persistProjectOrder(projectIds, savedProjects, requestId)
        }
      }

      // Mi ritorna true cosi poi chiudo l'edit della card
      return true
    } catch (_e) {
      toast.error("There was an error saving the project.")
      return false
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <WebHeader
        title="Projects"
        description="Manage and view projects displayed on the web platform."
        action={{
          label: "Add Project",
          icon: <PlusIcon className="size-4" />,
          onClick: handleAdd,
        }}
      />

      <div className="flex w-full">
        <Tabs
          value={activeCategory}
          onValueChange={(value) => setActiveCategory(value as ProjectCategory)}
          className="w-full space-y-4"
        >
          <TabsList>
            {PROJECT_CATEGORIES.map((category) => (
              <TabsTrigger key={category.value} value={category.value}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <ProjectsDrag
            projects={projects}
            activeCategory={activeCategory}
            editingProjectId={editingProjectId}
            draftProjectIds={draftProjectIds}
            onReorder={handleProjectsReorder}
            onCancelCreate={removeProjectLocally}
            onDelete={handleDelete}
            onCategoryChange={handleCategoryChange}
            onSave={handleSave}
          />
        </Tabs>
      </div>
    </div>
  )
}
