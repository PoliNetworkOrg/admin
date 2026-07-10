import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, MessageCircle } from "lucide-react"

export const Route = createFileRoute("/onboarding/link")({ component: LinkTelegram })

function LinkTelegram() {
  return (
    <main className="onboarding-page">
      <div className="onboarding-card">
        <span className="onboarding-icon">
          <MessageCircle size={26} />
        </span>
        <p className="eyebrow">ONE LAST STEP</p>
        <h1>Link your Telegram account</h1>
        <p>We use your Telegram identity to verify the administrative roles that grant access to this workspace.</p>
        <button className="primary-button">
          Connect Telegram <ArrowRight size={16} />
        </button>
        <Link to="/login" className="text-button">
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
