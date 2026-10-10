import { redirect } from "@tanstack/react-router"

/** Full-page navigation to the IdP sign-in (`/auth/login`), returning to `returnTo` afterwards. */
export function signInRedirect(returnTo?: string) {
  const query = returnTo ? `?${new URLSearchParams({ returnTo })}` : ""
  return redirect({ href: `/auth/login${query}`, reloadDocument: true })
}
