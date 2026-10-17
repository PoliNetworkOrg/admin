/**
 * Signs out through a form POST to `/auth/logout`: a document navigation, so the browser follows the redirect to the
 * IdP's end-session endpoint, and a POST, so it carries the `Origin` the CSRF check requires.
 */
export function submitSignOut() {
  const form = document.createElement("form")
  form.method = "post"
  form.action = "/auth/logout"
  form.hidden = true
  document.body.append(form)
  form.submit()
}
