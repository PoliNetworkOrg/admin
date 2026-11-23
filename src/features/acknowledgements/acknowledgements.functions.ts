import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webContentWriteMiddleware } from "@/server/auth.middleware"

import {
  acknowledgementGroupInput,
  acknowledgementIdInput,
  acknowledgementInput,
  reorderAcknowledgementGroupsInput,
  reorderAcknowledgementsInput,
  updateAcknowledgementGroupInput,
  updateAcknowledgementInput,
} from "./acknowledgements.validation"

/** The role groups of the website section with their people, and the projects list, in display order. */
export const getAcknowledgements = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.acknowledgements.getAll.query())

export const createAcknowledgementGroup = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(acknowledgementGroupInput)
  .handler(({ data, context }) => context.backend.web.acknowledgements.createGroup.mutate(data))

export const updateAcknowledgementGroup = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(updateAcknowledgementGroupInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.updateGroup.mutate(data)
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteAcknowledgementGroup = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(acknowledgementIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.deleteGroup.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderAcknowledgementGroups = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(reorderAcknowledgementGroupsInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.reorderGroups.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const createAcknowledgement = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(acknowledgementInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.createEntry.mutate({
      ...data,
      detail: data.detail || null,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const updateAcknowledgement = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(updateAcknowledgementInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.updateEntry.mutate({
      ...data,
      detail: data.detail || null,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteAcknowledgement = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(acknowledgementIdInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.deleteEntry.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const reorderAcknowledgements = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(reorderAcknowledgementsInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.acknowledgements.reorderEntries.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
