import { useRouter } from "@tanstack/react-router"
import {
  CalendarClock,
  ExternalLink,
  History,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CreateGrantDialog } from "@/components/telegram/create-grant-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { InterruptGrantDialog } from "./grant-dialogs"
import { AddGroupAdminDialog, RemoveGroupAdminDialog } from "./group-admin-dialog"
import { RoleDialog } from "./role-dialog"
import { Definition, DetailSection, SectionEmpty, SummaryCard } from "./sections"
import type { TelegramUserDetail } from "./types"

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function messageLink(chatId: number, messageId: number) {
  return `https://t.me/c/${String(chatId).replace("-100", "")}/${messageId}`
}

function groupLink(chatId: number, messageId: number, inviteLink?: string | null) {
  return inviteLink ?? messageLink(chatId, messageId)
}

function GrantDetails({
  label,
  status,
  validSince,
  validUntil,
}: {
  label: string
  status: "Active" | "Scheduled"
  validSince: Date | string
  validUntil: Date | string
}) {
  return (
    <dl className="grid gap-2 text-xs">
      <Definition label={label}>
        <Badge variant={status === "Scheduled" ? "secondary" : "default"}>{status}</Badge>
      </Definition>
      <Definition label="Valid from">{formatDate(validSince)}</Definition>
      <Definition label="Valid until">{formatDate(validUntil)}</Definition>
    </dl>
  )
}

export function TelegramUserProfile({ data }: { data: TelegramUserDetail }) {
  const router = useRouter()
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const { user, roles, configuredRoles, groupAdmin, groups, messages, audits, ongoingGrant, scheduledGrants } = data
  const administeredGroups = groupAdmin.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"

  return (
    <>
      <Card className="mt-5 [--card-spacing:--spacing(5)]">
        <CardHeader className="flex flex-row items-center gap-4 max-[600px]:flex-wrap">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary font-mono text-base font-semibold text-primary-foreground">
              {(user.firstName?.[0] ?? user.username?.[0] ?? String(user.id).slice(-2)).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-medium tracking-[0.08em] text-primary uppercase">
              Telegram profile · {user.id}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.username ? `@${user.username}` : "No Telegram username"}
            </p>
          </div>
          <Badge variant="secondary">
            {roles.length} role{roles.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
      </Card>

      <section className="mt-[18px] grid grid-cols-3 gap-3.5 max-[900px]:grid-cols-1">
        <SummaryCard icon={UserRound} label="IDENTITY">
          <dl className="grid gap-2 text-xs">
            <Definition label="Telegram ID">
              <span className="font-mono text-[10px]">{user.id}</span>
            </Definition>
            <Definition label="Name">{displayName}</Definition>
            <Definition label="Username">{user.username ? `@${user.username}` : "—"}</Definition>
          </dl>
        </SummaryCard>
        <SummaryCard
          icon={ShieldCheck}
          label="ROLES"
          actions={
            <>
              <RoleDialog mode="add" userId={user.id} roles={roles} configuredRoles={configuredRoles} />
              <RoleDialog mode="remove" userId={user.id} roles={roles} configuredRoles={configuredRoles} />
            </>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {roles.length ? (
              roles.map((role) => (
                <Badge key={role} className="h-5 bg-accent px-1.5 font-mono text-[9px] text-primary">
                  {role}
                </Badge>
              ))
            ) : (
              <span className="text-[11px] italic text-muted-foreground">No assigned roles</span>
            )}
          </div>
        </SummaryCard>
        <SummaryCard
          icon={CalendarClock}
          label="GRANTS"
          actions={
            <>
              <CreateGrantDialog user={user} />
              {ongoingGrant && <InterruptGrantDialog userId={user.id} displayName={displayName} />}
            </>
          }
        >
          {ongoingGrant || scheduledGrants.length ? (
            <div className="grid gap-4">
              {ongoingGrant && (
                <GrantDetails
                  label="Ongoing"
                  status="Active"
                  validSince={ongoingGrant.validSince}
                  validUntil={ongoingGrant.validUntil}
                />
              )}
              {scheduledGrants.map((scheduledGrant, index) => (
                <GrantDetails
                  key={`${scheduledGrant.validSince.toString()}-${scheduledGrant.validUntil.toString()}-${index}`}
                  label={`Scheduled ${index + 1}`}
                  status="Scheduled"
                  validSince={scheduledGrant.validSince}
                  validUntil={scheduledGrant.validUntil}
                />
              ))}
            </div>
          ) : (
            <span className="text-[11px] italic text-muted-foreground">No active or scheduled grants</span>
          )}
        </SummaryCard>
      </section>

      <DetailSection
        icon={UsersRound}
        title="Group administration"
        count={administeredGroups.length}
        action={
          <Button variant="outline" size="sm" className="text-[10px]" onClick={() => setAdminDialogOpen(true)}>
            <UserPlus data-icon="inline-start" /> Add group
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {administeredGroups.map((entry) => (
            <Card size="sm" key={entry.group.id}>
              <CardContent className="p-5">
                <h3 className="text-[13px]">{entry.group.title}</h3>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{entry.group.id}</p>
                <small className="mt-3 block text-[10px] text-muted-foreground">
                  Added by {entry.addedBy.firstName}
                  {entry.addedBy.username ? ` · @${entry.addedBy.username}` : ""}
                </small>
                <div className="mt-3 border-t border-border pt-3">
                  <RemoveGroupAdminDialog
                    userId={user.id}
                    groupId={entry.group.id}
                    groupTitle={entry.group.title}
                    onSaved={async () => {
                      toast.success("Group administrator removed.")
                      try {
                        await router.invalidate({ sync: true })
                      } catch (error) {
                        console.error(error)
                        toast.warning("The assignment was removed, but the latest user data could not be refreshed.")
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          {!administeredGroups.length && <SectionEmpty text="This user does not administer any group." />}
        </div>
      </DetailSection>
      <AddGroupAdminDialog
        open={adminDialogOpen}
        userId={user.id}
        groups={groups}
        administeredGroupIds={new Set(administeredGroups.map((entry) => entry.group.id))}
        onClose={() => setAdminDialogOpen(false)}
        onSaved={async () => {
          setAdminDialogOpen(false)
          toast.success("Group administrator added.")
          try {
            await router.invalidate({ sync: true })
          } catch (error) {
            console.error(error)
            toast.warning("The administrator was added, but the latest user data could not be refreshed.")
          }
        }}
      />
      <DetailSection icon={MessageCircle} title="Recent messages" count={messages.length}>
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {messages.map((message) => (
            <Card size="sm" key={`${message.chatId}-${message.messageId}`} className="gap-0 py-0">
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/35 px-5 py-4">
                  <div className="min-w-0">
                    <a
                      className="group/link inline-flex max-w-full items-center gap-1.5 rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
                      href={groupLink(message.chatId, message.messageId, message.group?.inviteLink)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="truncate">{message.group?.title ?? `Chat ${message.chatId}`}</span>
                      <ExternalLink className="size-3.5 shrink-0 opacity-65 transition-opacity group-hover/link:opacity-100" />
                    </a>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">Chat {message.chatId}</p>
                  </div>
                  <time className="shrink-0 text-right text-[10px] leading-4 text-muted-foreground">
                    {formatDate(message.timestamp)}
                  </time>
                </div>
                <div className="px-5 py-4">
                  <p className="border-l-2 border-primary/35 pl-3 text-[13px] leading-5 whitespace-pre-wrap">
                    {message.message}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-[9px] text-muted-foreground">Message #{message.messageId}</span>
                    <a
                      className="flex items-center gap-1 rounded-sm font-mono text-[10px] font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
                      href={messageLink(message.chatId, message.messageId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open message <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!messages.length && <SectionEmpty text="No recent messages from this user." />}
        </div>
      </DetailSection>
      <DetailSection icon={History} title="Audit log" count={audits.length}>
        <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
          {audits.map((audit) => (
            <Card size="sm" key={`${audit.id}-${audit.type}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[13px]">{audit.type}</h3>
                  <time className="shrink-0 text-[10px] text-muted-foreground">{formatDate(audit.createdAt)}</time>
                </div>
                <p className="mt-3 text-xs leading-[1.5]">{audit.reason ?? "No reason provided"}</p>
                {audit.groupTitle && (
                  <small className="mt-2 block text-[10px] text-muted-foreground">
                    {audit.groupTitle} · {audit.groupId}
                  </small>
                )}
              </CardContent>
            </Card>
          ))}
          {!audits.length && <SectionEmpty text="No audit events found for this user." />}
        </div>
      </DetailSection>
    </>
  )
}
