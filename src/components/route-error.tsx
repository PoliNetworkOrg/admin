import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router"
import { SearchX, TriangleAlert } from "lucide-react"
import { type ReactNode, useState } from "react"

import { buttonMotion, EmptyState, LoadingButton } from "@/components/primitives"
import { PageContent, useInShell } from "@/components/shell"
import { Button } from "@/components/ui/button"

/**
 * Inside the dashboard shell (a page route's boundary) the state sits in the content column; above it (the root
 * and `/dashboard` boundaries) it is centred on the page background.
 */
function ErrorFrame({ children }: { children: ReactNode }) {
  const inShell = useInShell()
  const surface = <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">{children}</div>
  if (inShell) return <PageContent width="record">{surface}</PageContent>
  return (
    <div className="grid min-h-dvh place-items-center bg-(--pn-bg) p-6 text-(--pn-fg)">
      <div className="w-full max-w-[560px]">{surface}</div>
    </div>
  )
}

function OverviewLink({ variant }: { variant: "outline" | "ghost" }) {
  return (
    <Button variant={variant} size="sm" className={buttonMotion} nativeButton={false} render={<Link to="/dashboard" />}>
      Return to overview
    </Button>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const message =
    import.meta.env.DEV && error instanceof Error
      ? error.message
      : "The requested data could not be loaded. Try again or return to the overview."

  async function retry() {
    setRetrying(true)
    reset()
    await router.invalidate({ sync: true })
    setRetrying(false)
  }

  return (
    <ErrorFrame>
      <EmptyState
        icon={TriangleAlert}
        title="This area could not be loaded"
        text={message}
        action={
          <>
            <LoadingButton variant="outline" pending={retrying} onClick={() => void retry()}>
              Retry
            </LoadingButton>
            <OverviewLink variant="ghost" />
          </>
        }
      />
    </ErrorFrame>
  )
}

export function RouteNotFound() {
  return (
    <ErrorFrame>
      <EmptyState
        icon={SearchX}
        title="Page not found"
        text="The requested page or record does not exist."
        action={<OverviewLink variant="outline" />}
      />
    </ErrorFrame>
  )
}
