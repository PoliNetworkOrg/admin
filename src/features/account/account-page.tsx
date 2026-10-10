import { ExternalLink, Info, LogOut } from "lucide-react"

import { buttonMotion, Chip, initialsOf, KeyValueList, LoadingButton, SectionCard } from "@/components/primitives"
import { PageBar, PageContent, useSignOut } from "@/components/shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { DashboardUser } from "@/lib/auth"

type AccountPageProps = {
  user: DashboardUser
  permissions: readonly string[]
  /** PoliNetwork Auth's account page, where the profile, Telegram link, passkeys and sessions are managed. */
  accountUrl: string
}

/** Account: the IdP profile, the linked Telegram account, dashboard permissions, sign out. */
export function AccountPage({ user, permissions, accountUrl }: AccountPageProps) {
  return (
    <>
      <PageBar title="Account" width="settings" />
      <PageContent width="settings">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-6">
            <ProfileCard user={user} accountUrl={accountUrl} />
            <TelegramCard telegramId={user.telegramId} accountUrl={accountUrl} />
            <PermissionsCard permissions={permissions} />
          </div>
          <SignOutCard />
        </div>
      </PageContent>
    </>
  )
}

function IdpLink({ href, children }: { href: string; children: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={buttonMotion}
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noreferrer" />}
    >
      {children}
      <ExternalLink aria-hidden data-icon="inline-end" />
    </Button>
  )
}

function ProfileCard({ user, accountUrl }: { user: DashboardUser; accountUrl: string }) {
  return (
    <SectionCard title="Profile" padding="settings" action={<IdpLink href={accountUrl}>Manage account</IdpLink>}>
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-16 after:border-(--pn-line)">
            {user.picture && <AvatarImage src={user.picture} alt="" />}
            <AvatarFallback className="bg-(--pn-accent-solid) text-lg font-medium text-(--pn-accent-solid-fg)">
              {initialsOf(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-sm leading-5 font-medium" title={user.name}>
              {user.name || user.email}
            </p>
            <p className="truncate text-[13px] leading-5 text-(--pn-fg-muted)" title={user.email}>
              {user.email}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-(--pn-fg-muted)">
          <Info aria-hidden className="size-3.5 shrink-0" />
          Your name, picture, passkeys and sessions are managed in PoliNetwork Auth.
        </p>
      </div>
    </SectionCard>
  )
}

function TelegramCard({ telegramId, accountUrl }: { telegramId: string | null; accountUrl: string }) {
  return (
    <SectionCard
      title="Telegram"
      padding="settings"
      action={telegramId === null ? <IdpLink href={accountUrl}>Link Telegram</IdpLink> : undefined}
    >
      <div className="flex flex-col gap-4">
        <KeyValueList
          items={[
            {
              key: "Telegram ID",
              value: telegramId,
              mono: telegramId !== null,
              hint: telegramId === null ? "Not linked" : undefined,
            },
          ]}
        />
        <p className="flex items-center gap-1.5 text-xs text-(--pn-fg-muted)">
          <Info aria-hidden className="size-3.5 shrink-0" />
          Link your Telegram account in PoliNetwork Auth to use your permissions with the bot.
        </p>
      </div>
    </SectionCard>
  )
}

function PermissionsCard({ permissions }: { permissions: readonly string[] }) {
  return (
    <SectionCard title="Permissions" count={permissions.length} padding="settings">
      <div className="flex flex-col gap-4">
        <span className="flex flex-wrap gap-1.5">
          {permissions.map((permission) => (
            <Chip key={permission}>{permission}</Chip>
          ))}
        </span>
        <p className="flex items-center gap-1.5 text-xs text-(--pn-fg-muted)">
          <Info aria-hidden className="size-3.5 shrink-0" />
          Permissions come from your roles in PoliNetwork Auth.
        </p>
      </div>
    </SectionCard>
  )
}

/** The destructive zone: no confirmation, signing in again reverses it. */
function SignOutCard() {
  const { signOut, pending } = useSignOut()

  return (
    <SectionCard padding="settings">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm leading-5 font-medium text-(--pn-fg)">Sign out</p>
          <p className="text-xs text-(--pn-fg-muted)">Ends this dashboard session and your PoliNetwork Auth session.</p>
        </div>
        <LoadingButton variant="outline" tone="dangerOutline" icon={LogOut} pending={pending} onClick={signOut}>
          Sign out
        </LoadingButton>
      </div>
    </SectionCard>
  )
}
