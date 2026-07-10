import { CloudOff } from "lucide-react"

export function LiveStatus({ connected, message }: { connected: boolean; message?: string }) {
  return connected ? null : (
    <div className="connection-note">
      <CloudOff size={16} />
      <span>{message ?? "Live backend is offline."}</span>
    </div>
  )
}
