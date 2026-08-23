import { LoaderCircle, RefreshCw } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { AdminSession } from "@/lib/auth"

import { ProfileDetailsCard, ProfileSummaryCard, TelegramIdentityCard } from "./profile-sections"
import { PasskeysCard, SessionsCard } from "./security-sections"
import { useAccount } from "./use-account"

export function AccountPage({
  initialSession,
  telegramRoles,
}: {
  initialSession: AdminSession
  telegramRoles: string[]
}) {
  const account = useAccount(initialSession)

  return (
    <div className="animate-appear">
      <PageHeader
        eyebrow="Account"
        title="Profile and security"
        description="Manage your identity, passkeys and active sessions."
      />
      {account.notice && (
        <Alert variant={account.notice.type === "error" ? "destructive" : "default"} className="mt-4">
          <AlertDescription>{account.notice.text}</AlertDescription>
        </Alert>
      )}
      {account.securityError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{account.securityError}</AlertDescription>
          <AlertAction className="mt-2 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void account.refreshSecurityData(true)}
              disabled={account.securityRefreshing}
            >
              {account.securityRefreshing ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Retry security data
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="mt-5 grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <ProfileSummaryCard
          user={account.user}
          busy={account.busy}
          onUpload={(file) => void account.uploadImage(file)}
          onRemove={() => void account.removeImage()}
        />
        <ProfileDetailsCard
          user={account.user}
          name={account.name}
          busy={account.busy}
          onNameChange={account.setName}
          onSubmit={(event) => void account.updateName(event)}
        />
        <TelegramIdentityCard user={account.user} roles={telegramRoles} />
        <PasskeysCard
          passkeys={account.passkeys}
          busy={account.busy}
          loading={account.securityLoading}
          onAdd={() => void account.addPasskey()}
          onDelete={(id) => void account.deletePasskey(id)}
        />
        <SessionsCard
          sessions={account.sortedSessions}
          currentSessionId={account.currentSessionId}
          busy={account.busy}
          loading={account.securityLoading}
          onRevokeOthers={() => void account.revokeOtherSessions()}
          onLogout={() => void account.logout()}
        />
      </div>
    </div>
  )
}
