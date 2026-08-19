export function getForwardedCookieHeaders(requestHeaders: Headers) {
  const cookie = requestHeaders.get("cookie")
  return cookie ? { cookie } : undefined
}
