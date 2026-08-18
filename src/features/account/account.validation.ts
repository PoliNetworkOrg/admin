export function parseProfilePictureForm(data: FormData) {
  const image = data.get("image")
  if (!(image instanceof File)) throw new Error("INVALID_IMAGE")
  if (image.size > 1024 * 1024) throw new Error("IMAGE_TOO_LARGE")
  if (!["image/png", "image/jpeg"].includes(image.type)) throw new Error("INVALID_IMAGE_TYPE")
  return image
}
