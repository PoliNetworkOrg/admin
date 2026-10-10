type CookieOptions = { path: string; maxAgeSeconds: number; secure: boolean }

/** Every dashboard cookie is HttpOnly and SameSite=Lax; `secure` adds `Secure` (required by the name prefixes). */
export function serializeCookie(name: string, value: string, { path, maxAgeSeconds, secure }: CookieOptions) {
  const attributes = [`${name}=${value}`, `Path=${path}`, `Max-Age=${Math.floor(maxAgeSeconds)}`, "HttpOnly"]
  attributes.push("SameSite=Lax")
  if (secure) attributes.push("Secure")
  return attributes.join("; ")
}

export function expiredCookie(name: string, { path, secure }: Omit<CookieOptions, "maxAgeSeconds">) {
  return serializeCookie(name, "", { path, maxAgeSeconds: 0, secure })
}
