"use client"

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { flushSync } from "react-dom"
import { TabsContent } from "@/components/ui/tabs"
import CardProject from "./card-project"
import { PROJECT_CATEGORIES } from "./constants"
import type { Project, ProjectCategory, ProjectsDragProps } from "./types"

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

  const nextCategoryProjects = [...categoryProjects]
  const [movedProject] = nextCategoryProjects.splice(sourceIndex, 1)
  if (!movedProject) return null

  nextCategoryProjects.splice(targetIndex, 0, movedProject)

  let categoryIndex = 0
  const nextProjects = items.map((project) => {
    if (project.category !== category) return project
    return nextCategoryProjects[categoryIndex++] ?? project
  })

  return { nextProjects, orderedIds: nextCategoryProjects.map((project) => project.id) }
}

export function ProjectsDrag({
  projects,
  activeCategory,
  editingProjectId,
  draftProjectIds,
  onReorder,
  onCancelCreate,
  onDelete,
  onCategoryChange,
  onSave,
}: ProjectsDragProps) {
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

    // mi serve flush perche se no la ui si aggiorna in ritardo e sembra che aspetta il post (sembra strano l'effetto del frag senza)
    flushSync(() => {
      onReorder({ ...reordered, previousProjects: projects })
    })
  }

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      {PROJECT_CATEGORIES.map((category) => {
        const categoryProjects = projects.filter((project) => project.category === category.value)

        return (
          <TabsContent key={category.value} value={category.value} className="border-0 p-0 space-y-4">
            {categoryProjects.length === 0 && (
              <div className="grid min-h-64 place-items-center">
                <p className="text-center text-lg text-muted-foreground">{category.emptyLabel}</p>
              </div>
            )}
            {categoryProjects.map((item, index) => (
              <CardProject
                key={item.id}
                id={item.id}
                title={item.title}
                logo={item.logo}
                descriptionIt={item.descriptionIt}
                descriptionEn={item.descriptionEn}
                link={item.link}
                category={item.category}
                sortableIndex={index}
                initialEditActive={editingProjectId === item.id}
                isDraft={draftProjectIds.has(item.id)}
                onCancelCreate={() => onCancelCreate(item.id)}
                onDelete={() => onDelete(item.id)}
                onCategoryChange={(nextCategory) => onCategoryChange(item.id, nextCategory)}
                onSave={(values) => onSave(item.id, values)}
              />
            ))}
          </TabsContent>
        )
      })}
    </DragDropProvider>
  )
}
