import {
  Cloud,
  ExternalLink,
  Globe,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MessageCircle,
  Send,
  Tags,
} from "lucide-react"

import azureLogo from "@/assets/svg/azure.svg"
import telegramLogo from "@/assets/svg/telegram.svg"
import whatsappLogo from "@/assets/svg/whatsapp.svg"
import { buttonMotion, Chip, initialsOf, KeyValueList, LoadingButton, SectionCard } from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
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
            <Hint overflowOnly label={user.name}>
              <p className="truncate text-sm leading-5 font-medium">{user.name || user.email}</p>
            </Hint>
            <Hint overflowOnly label={user.email}>
              <p className="truncate text-[13px] leading-5 text-(--pn-fg-muted)">{user.email}</p>
            </Hint>
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

/** Permission prefixes → the area they unlock, in rail order; unknown prefixes fall under "Other". */
const PERMISSION_AREAS: { prefix: string; area: string; icon: LucideIcon; logo?: string }[] = [
  { prefix: "admin", area: "Dashboard", icon: LayoutDashboard },
  { prefix: "tg", area: "Telegram", icon: Send, logo: telegramLogo },
  { prefix: "wa", area: "WhatsApp", icon: MessageCircle, logo: whatsappLogo },
  { prefix: "groups", area: "Group labels", icon: Tags },
  { prefix: "azure", area: "Microsoft 365", icon: Cloud, logo: azureLogo },
  { prefix: "web", area: "Web", icon: Globe },
]

function groupPermissions(permissions: readonly string[]) {
  const known = PERMISSION_AREAS.map((area) => ({
    ...area,
    items: permissions.filter((permission) => permission.split(":")[0] === area.prefix),
  }))
  const other = permissions.filter(
    (permission) => !PERMISSION_AREAS.some((area) => permission.split(":")[0] === area.prefix)
  )
  return [...known, { prefix: "", area: "Other", icon: KeyRound, items: other }].filter((area) => area.items.length > 0)
}

function PermissionsCard({ permissions }: { permissions: readonly string[] }) {
  return (
    <SectionCard title="Permissions" count={permissions.length} padding="settings">
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col">
          {groupPermissions(permissions).map(({ area, icon: Icon, logo, items }) => (
            <div
              key={area}
              className="grid items-center gap-x-4 gap-y-2 border-b border-(--pn-line) py-3 first:pt-0 shell:grid-cols-[160px_minmax(0,1fr)]"
            >
              <dt className="flex items-center gap-2 font-medium text-(--pn-fg)">
                {logo ? (
                  <img src={logo} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
                ) : (
                  <Icon aria-hidden strokeWidth={1.75} className="size-4 text-(--pn-fg-muted)" />
                )}
                {area}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {items.map((permission) => (
                  <Chip key={permission} className="font-mono text-xs">
                    {permission}
                  </Chip>
                ))}
              </dd>
            </div>
          ))}
        </dl>
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
