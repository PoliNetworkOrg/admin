import { Link } from "@tanstack/react-router"
import { CloudOff, LogIn, RefreshCw } from "lucide-react"
import { useState } from "react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function LiveStatus({
  connected,
  message,
  onRetry,
}: {
  connected: boolean
  message?: string
  onRetry?: () => void | Promise<void>
}) {
  const [retrying, setRetrying] = useState(false)
  if (connected) return null

  const sessionExpired = message?.toLocaleLowerCase().includes("session")

  async function retry() {
    if (retrying) return
    setRetrying(true)
    try {
      if (onRetry) await onRetry()
      else window.location.reload()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Alert variant="destructive" className="mb-5 gap-y-1 p-3 pr-4 sm:pr-32" role="alert">
      <CloudOff />
      <AlertTitle>{sessionExpired ? "Session expired" : "Data unavailable"}</AlertTitle>
      <AlertDescription>
        {message ?? "The PoliNetwork backend could not be reached. Your current data view may be incomplete."}
      </AlertDescription>
      <AlertAction className="static mt-2 sm:absolute sm:top-1/2 sm:right-3 sm:mt-0 sm:-translate-y-1/2">
        {sessionExpired ? (
          <Button render={<Link to="/login" />} nativeButton={false} variant="outline" size="sm">
            <LogIn data-icon="inline-start" /> Sign in
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => void retry()} disabled={retrying} aria-busy={retrying}>
            <RefreshCw data-icon="inline-start" className={retrying ? "animate-spin-slow" : undefined} />
            {retrying ? "Retrying…" : "Retry"}
          </Button>
        )}
      </AlertAction>
    </Alert>
  )
}
