import { CloudOff } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function LiveStatus({ connected, message }: { connected: boolean; message?: string }) {
  return connected ? null : (
    <Alert className="mb-4 rounded-none border-l-[3px] border-l-[#d86b3f] bg-[#fff4e8] px-3 py-2.5 text-[11px] text-[#895322]">
      <CloudOff />
      <AlertDescription className="text-[11px] leading-[1.45] text-[#895322]">
        {message ?? "Live backend is offline."}
      </AlertDescription>
    </Alert>
  )
}
