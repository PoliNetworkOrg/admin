import { useCallback, useEffect, useState } from "react"

type Return<T> = {
  data: T | null | undefined
  update: (newData: T) => void
  remove: () => void
}

export function useLocalStorage<T extends object>(key: string): Return<T> {
  const [data, setData] = useState<T | null | undefined>()

  useEffect(() => {
    const saved = window.localStorage.getItem(key)
    setData(saved ? (JSON.parse(saved) as T) : null)
  }, [key])

  const update = useCallback(
    (newData: T) => {
      setData(newData)
      localStorage.setItem(key, JSON.stringify(newData))
    },
    [key]
  )

  const remove = useCallback(() => {
    setData(null)
    localStorage.removeItem(key)
  }, [key])

  return { data, update, remove }
}
