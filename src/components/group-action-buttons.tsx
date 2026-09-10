import { Eye, EyeOff, ExternalLink, LoaderCircle, Tag, X } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function InviteLinkButton({ link }: { link: string | null }) {
  if (!link) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "pointer-events-none text-muted-foreground opacity-50"
        )}
      >
        <X />
        <span className="sr-only">Not shared</span>
      </span>
    )
  }

  return (
    <a
      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "text-muted-foreground")}
      href={link}
      target="_blank"
      rel="noreferrer"
    >
      <ExternalLink />
      <span className="sr-only">Open invite link</span>
    </a>
  )
}

export function VisibilityToggleButton({
  title,
  visible,
  pending,
  onToggle,
}: {
  title: string
  visible: boolean
  pending: boolean
  onToggle: () => void
}) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className={cn(visible ? "border-primary/30 bg-accent text-primary" : "text-muted-foreground")}
      disabled={pending}
      aria-busy={pending}
      aria-pressed={visible}
      aria-label={`${title} is ${visible ? "visible" : "hidden"}. Change visibility`}
      onClick={onToggle}
    >
      {pending ? <LoaderCircle className="animate-spin-slow" /> : visible ? <Eye /> : <EyeOff />}
    </Button>
  )
}

export function EditLabelsButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="border-amber-300 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:border-amber-400/30 dark:text-amber-300"
      aria-label={`Edit labels for ${title}`}
      onClick={onClick}
    >
      <Tag />
    </Button>
  )
}
