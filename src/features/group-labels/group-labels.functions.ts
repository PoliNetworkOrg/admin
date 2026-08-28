import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, writeAdminMiddleware } from "@/server/auth.middleware"

import { createGroupLabelInput, editGroupLabelInput, groupLabelIdInput } from "./group-labels.validation"
import type { GroupLabel } from "./types"

// TODO: replace this seed data once `@polinetwork/backend` exposes a real `web.groupLabels` router.
// Swap these handlers for `context.backend.web.groupLabels.*` calls (same shape as associations.functions.ts).
let groupLabels: GroupLabel[] = [
  { id: 1, label: "Affitti", color: "blue", description: "Room and apartment rental listings." },
  { id: 2, label: "Mercatino", color: "green", description: "Buying and selling books and course materials." },
  { id: 3, label: "Eventi", color: "purple", description: "Student-organized events and evenings out." },
  { id: 4, label: "Hobby", color: "orange", description: "Groups for hobbies and free time." },
]
let nextGroupLabelId = groupLabels.length + 1

export const listGroupLabels = createServerFn()
  .middleware([adminMiddleware])
  .handler(() => groupLabels)

export const createGroupLabel = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(createGroupLabelInput)
  .handler(({ data }) => {
    const groupLabel: GroupLabel = { id: nextGroupLabelId++, ...data }
    groupLabels = [...groupLabels, groupLabel]
    return groupLabel
  })

export const editGroupLabel = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(editGroupLabelInput)
  .handler(({ data }) => {
    if (!groupLabels.some((groupLabel) => groupLabel.id === data.id)) throw new Error("NOT_FOUND")
    const updated: GroupLabel = { id: data.id, label: data.label, color: data.color, description: data.description }
    groupLabels = groupLabels.map((groupLabel) => (groupLabel.id === data.id ? updated : groupLabel))
    return updated
  })

export const deleteGroupLabel = createServerFn({ method: "POST" })
  .middleware([writeAdminMiddleware])
  .validator(groupLabelIdInput)
  .handler(({ data }) => {
    if (!groupLabels.some((groupLabel) => groupLabel.id === data.id)) throw new Error("NOT_FOUND")
    groupLabels = groupLabels.filter((groupLabel) => groupLabel.id !== data.id)
    return { error: null }
  })
