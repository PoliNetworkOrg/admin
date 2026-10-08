import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react"
import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const icons = {
  success: <CircleCheck className="size-4" />,
  info: <Info className="size-4" />,
  warning: <TriangleAlert className="size-4" />,
  error: <CircleX className="size-4" />,
}

/** The app's one Toaster: bottom-right, three visible, untinted `app-toast` surfaces. */
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
      position="bottom-right"
      offset={24}
      mobileOffset={16}
      visibleToasts={3}
      duration={4000}
      icons={icons}
      className="toaster group"
      toastOptions={{ classNames: { toast: "app-toast" } }}
      {...props}
    />
  )
}

export { Toaster }
