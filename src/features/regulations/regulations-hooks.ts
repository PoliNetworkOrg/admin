import { useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"

import { appToast } from "@/components/shell"
import { errorHasCode, errorMessage } from "@/lib/errors"

/**
 * After a successful mutation: reload every loader, then confirm. A failed reload is not a failed mutation, so it
 * warns instead of offering to repeat it.
 */
export function useRefreshAfter() {
  const router = useRouter()
  return async (message: string) => {
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
      appToast.warning(`${message.replace(/\.$/, "")}, ma la pagina non si è aggiornata.`)
      return
    }
    appToast.success(message)
  }
}

/** tRPC's input validation failure: `data.zodError` set. */
const inputValidationError = z.object({ data: z.object({ zodError: z.object({}).loose() }) })

/**
 * The message for a failed call. The backend's refusals carry an Italian sentence meant for people ("C'è già una
 * bozza in approvazione…"); input validation and the policy's English denials ("Missing permission") don't, so they
 * get the fallback.
 */
export function failureMessage(cause: unknown, fallback: string) {
  if (errorHasCode(cause, "UNAUTHORIZED") || errorHasCode(cause, "Missing permission")) return fallback
  if (inputValidationError.safeParse(cause).success) return fallback
  const message = errorMessage(cause, fallback)
  return /[àèéìòù]|\b(il|la|di|non|per|una?|è)\b/i.test(message) ? message : fallback
}

/** A PDF from a server function (base64) as a download. */
export function downloadPdf(file: { fileName: string; contentType: string; base64: string }) {
  const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }))
  const link = document.createElement("a")
  link.href = url
  link.download = file.fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Loads data while mounted, again whenever `load` changes (memoize it with its inputs), and not at all while it is
 * `null`. A late answer from an earlier `load` is ignored; with `keepPrevious` the last answer stays meanwhile.
 */
export function useLoaded<T>(load: (() => Promise<T>) | null, keepPrevious = false) {
  const [result, setResult] = useState<{ load: (() => Promise<T>) | null; data: T | null; failed: boolean }>({
    load: null,
    data: null,
    failed: false,
  })
  useEffect(() => {
    if (!load) return
    let current = true
    load().then(
      (data) => {
        if (current) setResult({ load, data, failed: false })
      },
      (caught) => {
        console.error(caught)
        if (current) setResult({ load, data: null, failed: true })
      }
    )
    return () => {
      current = false
    }
  }, [load])
  if (load && result.load === load) return { data: result.data, failed: result.failed }
  return { data: keepPrevious ? result.data : null, failed: false }
}
