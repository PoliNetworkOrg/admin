export function forwardAuthRequest(
  request: Request,
  backendBaseUrl: string,
  authPath: string,
  fetcher: typeof fetch = fetch
) {
  const incomingUrl = new URL(request.url)
  if (incomingUrl.pathname !== authPath && !incomingUrl.pathname.startsWith(`${authPath}/`)) {
    throw new Error("INVALID_AUTH_PROXY_PATH")
  }

  const backendUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendBaseUrl)
  return fetcher(new Request(backendUrl, request))
}
