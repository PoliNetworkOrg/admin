import { useRouter } from "@tanstack/react-router"
import { useCallback, useState } from "react"
import { toast } from "sonner"

/**
 * Shared optimistic-update/rollback/refresh flow behind every group visibility toggle (Telegram, WhatsApp,
 * and the combined groups-by-label table). `mutate` performs the actual server call for a given group id;
 * callers adapt their own server fn's argument shape (e.g. `telegramId` vs `id`) to it.
 */
export function useGroupVisibilityToggle<TId extends number>(
  mutate: (id: TId, hide: boolean) => Promise<{ updated: boolean }>
) {
  const router = useRouter()
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const [updatingId, setUpdatingId] = useState<TId | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [refreshError, setRefreshError] = useState("")

  const resolveHide = useCallback((id: TId, actualHide: boolean): boolean => overrides[id] ?? actualHide, [overrides])

  const toggleVisibility = useCallback(
    async (id: TId, title: string, currentHide: boolean) => {
      if (updatingId !== null) return
      const hide = !currentHide
      setUpdatingId(id)
      setMutationError("")
      setOverrides((current) => ({ ...current, [id]: hide }))

      try {
        await mutate(id, hide)
        toast.success(`${title} is now ${hide ? "hidden" : "visible"}.`)
        try {
          await router.invalidate({ sync: true })
          setRefreshError("")
          setOverrides((current) => {
            const { [id]: _removed, ...remaining } = current
            return remaining
          })
        } catch (error) {
          console.error(error)
          setRefreshError("The visibility was updated, but the latest group data could not be refreshed.")
        }
      } catch (error) {
        console.error(error)
        setOverrides((current) => {
          const { [id]: _removed, ...remaining } = current
          return remaining
        })
        setMutationError("The visibility setting could not be updated. Check your permissions and try again.")
      } finally {
        setUpdatingId(null)
      }
    },
    [updatingId, mutate, router]
  )

  return { updatingId, mutationError, refreshError, resolveHide, toggleVisibility }
}
