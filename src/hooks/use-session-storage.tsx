import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react"

export function useSessionStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  // Read from sessionStorage on initialization
  const readValue = useCallback((): T => {
    if (typeof window === "undefined") {
      return initialValue
    }

    try {
      const item = window.sessionStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  }, [key, initialValue])

  const [storedValue, setStoredValue] = useState<T>(readValue)

  // Return a memoized setter function
  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value
        setStoredValue(valueToStore)

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
        }
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error)
      }
    },
    [key, storedValue]
  )

  // Keep state in sync if key changes
  useEffect(() => {
    setStoredValue(readValue())
  }, [key, readValue])

  return [storedValue, setValue]
}
