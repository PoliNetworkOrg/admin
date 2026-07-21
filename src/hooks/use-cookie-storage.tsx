import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from "react"
import { type CookieOptions, deleteCookie, getCookie, getDefaultCookieOptions, setCookie } from "@/utils/cookies"

export function useCookieStorage<T>(
  key: string,
  initialValue: T,
  options: CookieOptions = {}
): [T, Dispatch<SetStateAction<T>>] {
  const envOptions = useMemo(() => getDefaultCookieOptions(), [])
  const mergedOptions = useMemo(() => ({ ...envOptions, ...options }), [options, envOptions])

  const readValue = useCallback((): T => {
    if (typeof document === "undefined") {
      return initialValue
    }

    try {
      const item = getCookie(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      console.warn(`Error reading cookie "${key}":`, error)
      return initialValue
    }
  }, [key, initialValue])

  const [storedValue, setStoredValue] = useState<T>(readValue)

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)

        if (typeof document !== "undefined") {
          if (valueToStore === null || valueToStore === undefined) {
            deleteCookie(key, { path: mergedOptions.path, domain: mergedOptions.domain })
          } else {
            setCookie(key, JSON.stringify(valueToStore), mergedOptions)
          }
        }
      } catch (error) {
        console.warn(`Error setting cookie "${key}":`, error)
      }
    },
    [key, storedValue, mergedOptions]
  )

  return [storedValue, setValue]
}
