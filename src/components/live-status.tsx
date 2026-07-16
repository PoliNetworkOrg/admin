import { Link } from "@tanstack/react-router"
import { CloudOff, LogIn, RefreshCw } from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function LiveStatus({ connected, message }: { connected: boolean; message?: string }) {
  if (connected) return null

  const sessionExpired = message?.toLocaleLowerCase().includes("session")

  return (
    <Alert variant="destructive" className="mb-5 gap-y-1 p-3 pr-32">
      <CloudOff />
      <AlertTitle>{sessionExpired ? "Session expired" : "Data unavailable"}</AlertTitle>
      <AlertDescription>
        {message ?? "The PoliNetwork backend could not be reached. Your current data view may be incomplete."}
      </AlertDescription>
      <AlertAction className="top-1/2 right-3 -translate-y-1/2">
        {sessionExpired ? (
          <Button render={<Link to="/login" />} nativeButton={false} variant="outline" size="sm">
            <LogIn data-icon="inline-start" /> Sign in
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw data-icon="inline-start" /> Retry
          </Button>
        )}
      </AlertAction>
    </Alert>
  )
}
