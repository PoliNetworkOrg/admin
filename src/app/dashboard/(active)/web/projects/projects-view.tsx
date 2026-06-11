"use client"

import { PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WebHeader from "@/components/web-header"
import { createProject, deleteProject, editProject } from "@/server/actions/projects"
import CardProject from "./card-project"
import { DEFAULT_PROJECT, PROJECT_CATEGORIES } from "./constants"
import type { Project, ProjectCategory } from "./types"

export function ProjectsView({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [draftProjectIds, setDraftProjectIds] = useState<Set<number>>(new Set())
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>(DEFAULT_PROJECT.category)

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

  async function handleDelete(id: number) {
    if (draftProjectIds.has(id)) {
      removeProjectLocally(id)
      return
    }

    try {
      const result = await deleteProject(id)

      if (result.error === "UNAUTHORIZED") {
        toast.error("You don't have permission to delete projects.")
        return
      } else if (result.error === "NOT_FOUND") {
        toast.info("This project was already deleted.")
      } else {
        toast.success("Project deleted successfully.")
      }

      removeProjectLocally(id)
      router.refresh()
    } catch (_e) {
      toast.error("There was an error deleting the project.")
    }
  }

  async function handleCategoryChange(id: number, category: ProjectCategory) {
    const project = projects.find((item) => item.id === id)
    if (!project || project.category === category) return

    setProjects((items) => items.map((item) => (item.id === id ? { ...item, category } : item)))

    if (draftProjectIds.has(id)) return

    try {
      const result = await editProject({ ...project, category })

      if (result.error === "UNAUTHORIZED") {
        toast.error("You don't have permission to move projects.")
        setProjects((items) => items.map((item) => (item.id === id ? project : item)))
        return
      }

      if (result.error === "NOT_FOUND" || !result.project) {
        toast.error("There was an error moving the project.")
        setProjects((items) => items.map((item) => (item.id === id ? project : item)))
        return
      }

      setProjects((items) => items.map((item) => (item.id === id ? result.project : item)))
      toast.success("Project moved successfully.")
      router.refresh()
    } catch (_e) {
      toast.error("There was an error moving the project.")
      setProjects((items) => items.map((item) => (item.id === id ? project : item)))
    }
  }

  // Draft ne crea una nuova, altrimenti modifica quella esistente
  async function handleSave(id: number, values: Project) {
    try {
      const isDraft = draftProjectIds.has(id)
      const result = isDraft
        ? await createProject({
            id: id,
            title: values.title,
            logo: values.logo,
            descriptionIt: values.descriptionIt,
            descriptionEn: values.descriptionEn,
            link: values.link,
            category: values.category,
          })
        : await editProject({
            id,
            title: values.title,
            logo: values.logo,
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

      // anche qui, se facessi il refresh perderei gli altri edit locali
      setProjects((items) => items.map((item) => (item.id === id ? result.project : item)))
      setDraftProjectIds((ids) => {
        const nextIds = new Set(ids)
        nextIds.delete(id)
        return nextIds
      })
      setEditingProjectId((editingId) => (editingId === id ? null : editingId))
      toast.success(`Project ${isDraft ? "created" : "updated"} successfully.`)
      router.refresh()
      // Mi ritorna true cosi poi chiudo l'edit della card
      return true
    } catch (_e) {
      toast.error("There was an error saving the project.")
      return false
    }
  }

  return (
    <>
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

          {PROJECT_CATEGORIES.map((category) => {
            const categoryProjects = projects.filter((project) => project.category === category.value)

            return (
              <TabsContent key={category.value} value={category.value} className="border-0 p-0 space-y-4">
                {categoryProjects.length === 0 && (
                  <div className="grid min-h-64 place-items-center">
                    <p className="text-center text-lg text-muted-foreground">{category.emptyLabel}</p>
                  </div>
                )}
                {categoryProjects.map((item) => (
                  <CardProject
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    logo={item.logo}
                    descriptionIt={item.descriptionIt}
                    descriptionEn={item.descriptionEn}
                    link={item.link}
                    category={item.category}
                    initialEditActive={editingProjectId === item.id}
                    isDraft={draftProjectIds.has(item.id)}
                    onCancelCreate={() => removeProjectLocally(item.id)}
                    onDelete={() => handleDelete(item.id)}
                    onCategoryChange={(nextCategory) => handleCategoryChange(item.id, nextCategory)}
                    onSave={(values) => handleSave(item.id, values)}
                  />
                ))}
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </>
  )
}
