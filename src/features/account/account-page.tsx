import { Info, LogOut } from "lucide-react"

import { Chip, KeyValueList, LoadingButton, SectionCard } from "@/components/primitives"
import { PageBar, PageContent, useSignOut } from "@/components/shell"
import type { AdminSession } from "@/lib/auth"

import { ProfileCard } from "./profile-card"
import { PasskeysCard, SessionsCard } from "./security-cards"
import { useAccount } from "./use-account"

/** Account: profile, Telegram identity, passkeys, sessions, sign out. */
export function AccountPage({ initialSession, roles }: { initialSession: AdminSession; roles: readonly string[] }) {
  const account = useAccount(initialSession)

  return (
    <>
      <PageBar title="Account" width="settings" />
      <PageContent width="settings">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col gap-6">
            <ProfileCard
              user={account.user}
              onUpload={account.uploadImage}
              onRemove={account.removeImage}
              onRename={account.updateName}
            />
            <TelegramCard
              username={account.user.telegramUsername ?? null}
              telegramId={account.user.telegramId ?? null}
              roles={roles}
            />
            <PasskeysCard
              state={account.security.state}
              retrying={account.security.retrying}
              onRetry={() => void account.security.retry()}
              passkeys={account.passkeys}
              onAdd={account.addPasskey}
              onDelete={account.deletePasskey}
            />
            <SessionsCard
              state={account.security.state}
              sessions={account.sessions}
              currentSessionId={account.currentSessionId}
              onRevoke={account.revokeSession}
              onRevokeOthers={account.revokeOtherSessions}
            />
          </div>
          <SignOutCard />
        </div>
      </PageContent>
    </>
  )
}

type TelegramCardProps = { username: string | null; telegramId: number | string | null; roles: readonly string[] }

function TelegramCard({ username, telegramId, roles }: TelegramCardProps) {
  return (
    <SectionCard title="Telegram" padding="settings">
      <div className="flex flex-col gap-4">
        <KeyValueList
          items={[
            { key: "Username", value: username ? `@${username}` : null },
            {
              key: "Telegram ID",
              value: telegramId === null ? null : String(telegramId),
              mono: telegramId !== null,
              hint: telegramId === null ? "Not linked" : undefined,
            },
            {
              key: "Roles",
              value:
                roles.length === 0 ? null : (
                  <span className="flex flex-wrap gap-1.5">
                    {roles.map((role) => (
                      <Chip key={role}>{role}</Chip>
                    ))}
                  </span>
                ),
            },
          ]}
        />
        <p className="flex items-center gap-1.5 text-xs text-(--pn-fg-muted)">
          <Info aria-hidden className="size-3.5 shrink-0" />
          Roles and permissions come from this Telegram account.
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
          <p className="text-sm leading-5 font-medium text-(--pn-fg)">Sign out of this device</p>
          <p className="text-xs text-(--pn-fg-muted)">You will return to the sign-in page.</p>
        </div>
        <LoadingButton
          variant="outline"
          tone="dangerOutline"
          icon={LogOut}
          pending={pending}
          onClick={() => void signOut()}
        >
          Sign out
        </LoadingButton>
      </div>
    </SectionCard>
  )
}
