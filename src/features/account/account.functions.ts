import { createServerFn } from "@tanstack/react-start"
import { authenticatedMiddleware } from "@/server/auth.middleware"
import { parseProfilePictureForm } from "./account.validation"

export const uploadProfilePicture = createServerFn({ method: "POST" })
  .middleware([authenticatedMiddleware])
  .validator(parseProfilePictureForm)
  .handler(async ({ data: image, context }) => {
    const formData = new FormData()
    formData.set("userId", context.session.user.id)
    formData.set("image", image)
    const result = await context.backend.auth.updateProfilePic.mutate(formData)
    if (!result.success) throw new Error("PROFILE_PICTURE_NOT_UPDATED")
    return result
  })
