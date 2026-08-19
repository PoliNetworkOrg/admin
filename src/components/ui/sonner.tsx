import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const syncTheme = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "sonner-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
