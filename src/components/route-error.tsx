import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const message =
    import.meta.env.DEV && error instanceof Error
      ? error.message
      : "The requested data could not be loaded. Try again or return to the overview."

  async function retry() {
    reset()
    await router.invalidate({ sync: true })
  }

  return (
    <Card className="mx-auto max-w-2xl border-destructive/30">
      <CardContent className="px-6 py-10 text-center">
        <AlertTriangle className="mx-auto size-7 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold">This area could not be loaded</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => void retry()}>
            <RefreshCw data-icon="inline-start" /> Retry
          </Button>
          <Button render={<Link to="/dashboard" />} nativeButton={false} variant="outline">
            Return to overview
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function RouteNotFound() {
  return (
    <Card className="mx-auto max-w-2xl border-dashed">
      <CardContent className="px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The requested page or record does not exist.</p>
        <Button className="mt-5" render={<Link to="/dashboard" />} nativeButton={false}>
          Return to overview
        </Button>
      </CardContent>
    </Card>
  )
}
