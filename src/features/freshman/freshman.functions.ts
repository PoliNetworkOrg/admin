import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webContentWriteMiddleware } from "@/server/auth.middleware"

import { moveFreshmanCardInput, selectFreshmanFaqInput, updateFreshmanCardInput } from "./freshman.validation"

export const getFreshmanContent = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.freshman.getContent.query())

export const updateFreshmanCard = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(updateFreshmanCardInput)
  .handler(({ data, context }) => context.backend.web.freshman.updateCard.mutate(data))

export const moveFreshmanCard = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(moveFreshmanCardInput)
  .handler(({ data, context }) => context.backend.web.freshman.moveCard.mutate(data))

export const selectFreshmanFaq = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(selectFreshmanFaqInput)
  .handler(({ data, context }) => context.backend.web.freshman.selectFaq.mutate(data))
