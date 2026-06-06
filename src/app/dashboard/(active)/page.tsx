import { InfoIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CompleteProfile } from "./complete-profile"

export default function AdminHome() {
  return (
    <div className="container">
      <CompleteProfile />
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Page under construction</AlertTitle>
        <AlertDescription>Use the sidebar to access the sections</AlertDescription>
      </Alert>
    </div>
  )
}
