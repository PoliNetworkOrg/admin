import { useNavigate, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Link2, LinkIcon, LogOut, RefreshCw, TriangleAlert } from "lucide-react"
import { useState } from "react"

import { AppMark } from "@/components/app-mark"
import { InlineAlert, LoadingButton } from "@/components/primitives"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { submitSignOut } from "@/lib/sign-out"

import { assignmentLabel, formatDay, openAssignments } from "./people-format"
import { errorMessage } from "./people-hooks"
import { acceptPeopleInvite, type InviteCheck, type InviteOutcome } from "./people-invite-landing.functions"
import { AssignmentBadge, RefusalText } from "./people-ui"

export type InviteLandingState =
  | { step: "malformed" }
  | { step: "check"; token: string; check: InviteCheck }
  | { step: "linked"; outcome: InviteOutcome }

/** Who to ask when a link is spent or expired: the invite comes from HR or a Team Lead. */
const NEW_LINK = "Ask whoever invited you (HR, or your Team Lead) to send a new invite."

/**
 * The page a People invite email links to: confirm, link, and see the roles arrive. It stands outside the dashboard
 * shell, so it works for an account that can't open the dashboard yet.
 */
export function InviteLandingPage({ state }: { state: InviteLandingState }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background p-6 max-[520px]:p-3">
      <header className="flex items-center justify-between">
        <AppMark />
        <ThemeToggle />
      </header>
      <Card className="m-auto w-full max-w-[480px] [--card-spacing:--spacing(6)]">
        {state.step === "malformed" ? (
          <Invalid message="This link is incomplete. Open it again from the email, without changing it." />
        ) : state.step === "check" ? (
          state.check.status === "valid" ? (
            <Confirm token={state.token} check={state.check} />
          ) : (
            <Invalid message={state.check.message} account={state.check.account} />
          )
        ) : (
          <Outcome outcome={state.outcome} />
        )}
      </Card>
    </main>
  )
}

function Heading({ icon: Icon, title, text }: { icon: typeof Link2; title: string; text?: string }) {
  return (
    <CardHeader>
      <span className="mb-3 flex size-11 items-center justify-center rounded-lg bg-accent text-(--pn-accent)">
        <Icon className="size-5" />
      </span>
      <CardTitle className="text-2xl tracking-[-0.035em]">{title}</CardTitle>
      {text ? <CardDescription className="leading-6">{text}</CardDescription> : null}
    </CardHeader>
  )
}

function SignedInAs({ account }: { account: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Signed in as <span className="[overflow-wrap:anywhere]">{account}</span>
    </p>
  )
}

function SignOutButton({ label = "Use another account" }: { label?: string }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        setPending(true)
        submitSignOut()
      }}
    >
      <LogOut data-icon="inline-start" /> {label}
    </Button>
  )
}

function Invalid({ message, account }: { message: string; account?: string }) {
  return (
    <>
      <Heading icon={TriangleAlert} title="This link doesn't work" text={message} />
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          An invite link works once and expires after 14 days. {NEW_LINK}
        </p>
        {account ? <SignedInAs account={account} /> : null}
        <a href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Open the dashboard
        </a>
      </CardContent>
    </>
  )
}

function Confirm({ token, check }: { token: string; check: Extract<InviteCheck, { status: "valid" }> }) {
  const accept = useServerFn(acceptPeopleInvite)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { preview, account } = check

  async function link() {
    setPending(true)
    setError(null)
    try {
      await accept({ data: { token } })
    } catch (caught) {
      console.error(caught)
      setError(errorMessage(caught, "Couldn't link your account. Try again."))
      setPending(false)
      return
    }
    // The token is spent: show the outcome, and keep showing it on reload.
    await navigate({ to: "/people/invite", search: { linked: true }, replace: true })
  }

  return (
    <>
      <Heading icon={Link2} title={`Link this account to ${preview.name}?`} />
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm leading-6 text-muted-foreground">
          <p>
            PoliNetwork added {preview.name} to its people register. Linking gives this account the roles assigned
            there.
          </p>
          <p>
            You can use any account: your PoliNetwork one if you are a member, otherwise any Google account. It doesn't
            have to be the one at the address the invite was sent to. To use another one, sign out, then open the link
            in the email again.
          </p>
          <p>
            The link works once and expires on {formatDay(preview.expiresOn)}. If it stops working, ask whoever invited
            you (HR, or your Team Lead) for a new one.
          </p>
        </div>
        <SignedInAs account={account} />
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
        <div className="flex flex-wrap gap-2">
          <LoadingButton size="default" icon={LinkIcon} pending={pending} onClick={() => void link()}>
            Link this account
          </LoadingButton>
          <SignOutButton />
        </div>
      </CardContent>
    </>
  )
}

function Outcome({ outcome }: { outcome: InviteOutcome }) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  async function checkAgain() {
    setRefreshing(true)
    try {
      await router.invalidate({ sync: true })
    } catch (caught) {
      console.error(caught)
    } finally {
      setRefreshing(false)
    }
  }

  const checkButton = (
    <LoadingButton
      size="default"
      variant="outline"
      icon={RefreshCw}
      pending={refreshing}
      onClick={() => void checkAgain()}
    >
      Check again
    </LoadingButton>
  )
  const dashboard = (
    <a href="/dashboard" className={buttonVariants()}>
      Open the dashboard
    </a>
  )

  if (outcome.status === "waiting") {
    return (
      <>
        <Heading
          icon={Link2}
          title="Your account is linked"
          text="PoliNetwork Auth is applying your roles. It usually takes a minute; then the dashboard opens with them."
        />
        <CardContent className="space-y-4">
          <SignedInAs account={outcome.account} />
          <div className="flex flex-wrap gap-2">
            {dashboard}
            {checkButton}
          </div>
        </CardContent>
      </>
    )
  }

  const roles = openAssignments({ assignments: outcome.assignments })
  const refused = roles.some((assignment) => assignment.status === "refused")
  const waiting = roles.some((assignment) => assignment.status === "sent" || assignment.status === "pending")
  return (
    <>
      <Heading
        icon={Link2}
        title={`Linked to ${outcome.name}`}
        text={
          refused
            ? "PoliNetwork Auth refused some of your roles. Whoever assigned them can assign them again."
            : waiting
              ? "PoliNetwork Auth is applying your roles."
              : "Your roles are applied."
        }
      />
      <CardContent className="space-y-4">
        {roles.length ? (
          <ul className="divide-y rounded-lg border">
            {roles.map((assignment) => (
              <li key={assignment.id} className="flex flex-col gap-1 px-3 py-2.5">
                <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                  {assignmentLabel(assignment)}
                  <AssignmentBadge assignment={assignment} showApplied />
                </span>
                {assignment.status === "refused" ? <RefusalText refusal={assignment.refusal} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No roles are assigned to this record yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {dashboard}
          {waiting ? checkButton : null}
        </div>
      </CardContent>
    </>
  )
}
