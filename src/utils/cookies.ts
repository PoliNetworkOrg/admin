export type CookieOptions = {
  expires?: Date | number // Date or days from now
  path?: string
  domain?: string
  secure?: boolean
  sameSite?: "strict" | "lax" | "none"
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === "undefined") return

  const { expires, path, domain, secure, sameSite } = options

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (expires !== undefined) {
    const date = expires instanceof Date ? expires : new Date(Date.now() + expires * 864e5)
    cookieString += `; expires=${date.toUTCString()}`
  }

  if (path) cookieString += `; path=${path}`
  if (domain) cookieString += `; domain=${domain}`
  if (secure) cookieString += "; secure"
  if (sameSite) cookieString += `; samesite=${sameSite}`

  document.cookie = cookieString
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${encodeURIComponent(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  )

  return match && match[1] ? decodeURIComponent(match[1]) : null
}

export function deleteCookie(name: string, options: Pick<CookieOptions, "path" | "domain"> = {}): void {
  setCookie(name, "", { ...options, expires: new Date(0) })
}

export function getDefaultCookieOptions(): CookieOptions {
  return process.env.NODE_ENV === "development"
    ? {
        path: "/",
        sameSite: "lax",
      }
    : {
        path: "/",
        domain: ".polinetwork.org",
        secure: true,
        sameSite: "strict",
      }
}
