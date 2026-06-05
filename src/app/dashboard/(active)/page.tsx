import { InfoIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getServerSession } from "@/server/auth"
import { CompleteProfile } from "./complete-profile"

export default async function AdminHome() {
  const { data: session } = await getServerSession()
  return (
    session && (
      <div className="container">
        <CompleteProfile user={session.user} />
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Page under construction</AlertTitle>
          <AlertDescription>Use the sidebar to access the sections</AlertDescription>
        </Alert>
      </div>
    )
  )
}
