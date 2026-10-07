export const MAX_PROFILE_PICTURE_BYTES = 1024 * 1024
const PROFILE_PICTURE_TYPES = new Set(["image/png", "image/jpeg"])

/** PNG or JPEG, up to 1 MB: the rule the backend enforces, checked on the client before uploading. */
export function isValidProfilePicture(file: File) {
  return PROFILE_PICTURE_TYPES.has(file.type) && file.size <= MAX_PROFILE_PICTURE_BYTES
}

export function parseProfilePictureForm(data: FormData) {
  const image = data.get("image")
  if (!(image instanceof File)) throw new Error("INVALID_IMAGE")
  if (image.size > MAX_PROFILE_PICTURE_BYTES) throw new Error("IMAGE_TOO_LARGE")
  if (!PROFILE_PICTURE_TYPES.has(image.type)) throw new Error("INVALID_IMAGE_TYPE")
  return image
}
