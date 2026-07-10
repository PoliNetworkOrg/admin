import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/onboarding/link")({ component: LinkTelegram })

function LinkTelegram() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <div className="grid max-w-[440px] justify-items-center gap-3.5 border border-border bg-card p-[42px] text-center max-[600px]:p-7">
        <span className="grid size-[52px] place-items-center rounded-full bg-accent text-primary">
          <MessageCircle />
        </span>
        <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
          ONE LAST STEP
        </p>
        <h1 className="font-serif text-[28px] leading-[1.1] tracking-[-0.06em]">Link your Telegram account</h1>
        <p className="text-xs leading-[1.6] text-muted-foreground">
          We use your Telegram identity to verify the administrative roles that grant access to this workspace.
        </p>
        <Button className="mt-1 rounded-none bg-primary text-[11px] hover:bg-primary/85">
          Connect Telegram <ArrowRight data-icon="inline-end" />
        </Button>
        <Button
          variant="link"
          className="h-auto rounded-none px-0 py-1 text-[11px] text-primary"
          render={<Link to="/login" />}
        >
          Back to sign in
        </Button>
      </div>
    </main>
  )
}
