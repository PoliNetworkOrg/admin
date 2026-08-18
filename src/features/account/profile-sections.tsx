import { Camera, LoaderCircle, ShieldCheck, UserRound } from "lucide-react"
import { useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { AdminSession } from "@/lib/auth"
import { ConfirmationDialog } from "./confirmation-dialog"

type User = AdminSession["user"]

export function ProfileSummaryCard({
  user,
  busy,
  onUpload,
  onRemove,
}: {
  user: User
  busy: string | null
  onUpload: (file?: File) => void
  onRemove: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <Card className="col-span-2 max-[900px]:grid-cols-1">
      <CardHeader className="flex flex-row items-center gap-4 max-[600px]:flex-wrap">
        <div className="relative">
          <Avatar className="size-20 after:border-0">
            {user.image && <AvatarImage src={user.image} alt="Your profile" />}
            <AvatarFallback className="bg-primary font-mono text-base text-primary-foreground">
              {avatarText(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-[-5px] bottom-[-5px] rounded-full border border-background bg-card"
            onClick={() => fileInput.current?.click()}
            disabled={busy === "image"}
            aria-label="Upload profile picture"
          >
            <Camera />
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{user.name || "Complete your profile"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
          <span className="mt-1.5 block font-mono text-[10px] text-primary">
            {user.telegramUsername
              ? `@${user.telegramUsername}`
              : user.telegramId
                ? `Telegram ID ${user.telegramId}`
                : "Telegram not linked"}
          </span>
        </div>
        {user.image && (
          <ConfirmationDialog
            trigger={
              <Button variant="outline" size="sm" className="text-[10px] text-destructive" disabled={busy === "image"}>
                Remove picture
              </Button>
            }
            title="Remove profile picture?"
            description="Your current profile picture will be removed from this account."
            actionLabel="Remove picture"
            onConfirm={onRemove}
          />
        )}
      </CardHeader>
    </Card>
  )
}

export function ProfileDetailsCard({
  user,
  name,
  busy,
  onNameChange,
  onSubmit,
}: {
  user: User
  name: string
  busy: string | null
  onNameChange: (name: string) => void
  onSubmit: (event: React.FormEvent) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 border-b border-border">
        <UserRound className="mt-0.5 size-5 shrink-0 text-primary" />
        <span>
          <CardTitle>Profile details</CardTitle>
          <CardDescription className="mt-1">Displayed throughout the admin console.</CardDescription>
        </span>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup className="gap-3.5">
            <Field>
              <FieldLabel htmlFor="full-name">Full name</FieldLabel>
              <Input
                id="full-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                autoComplete="name"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-email">Email address</FieldLabel>
              <Input id="account-email" value={user.email} disabled />
            </Field>
            <Button type="submit" className="w-max" disabled={busy === "name" || name.trim() === user.name}>
              {busy === "name" && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />} Save profile
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export function TelegramIdentityCard({ user, roles }: { user: User; roles: readonly string[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 border-b border-border">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" />
        <span>
          <CardTitle>Telegram identity</CardTitle>
          <CardDescription className="mt-1">Used to determine roles and permissions.</CardDescription>
        </span>
      </CardHeader>
      <CardContent className="grid gap-3 text-xs">
        <dl className="grid gap-3">
          <div>
            <dt className="font-mono text-[10px] text-muted-foreground">Username</dt>
            <dd className="mt-1">{user.telegramUsername ? `@${user.telegramUsername}` : "Not available"}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-muted-foreground">Telegram ID</dt>
            <dd className="mt-1 font-mono text-[10px]">{user.telegramId ?? "Not linked"}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] text-muted-foreground">Roles</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {roles.length ? (
                roles.map((role) => (
                  <Badge key={role} variant="secondary" className="font-mono text-[9px] text-primary">
                    {role}
                  </Badge>
                ))
              ) : (
                <span className="text-[11px] italic text-muted-foreground">No assigned roles</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function avatarText(name?: string | null, email?: string) {
  return (name || email || "U")
    .split(/[\s.@_-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
