import { CloudOff } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function LiveStatus({ connected, message }: { connected: boolean; message?: string }) {
  return connected ? null : (
    <Alert variant="destructive" className="mb-4">
      <CloudOff />
      <AlertDescription>{message ?? "Live backend is offline."}</AlertDescription>
    </Alert>
  )
}
