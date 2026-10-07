import { CircleAlert, Lock } from "lucide-react"
import { type ChangeEvent, type FormEvent, useId, useRef, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  fieldControl,
  fieldHintId,
  FormField,
  Hint,
  initialsOf,
  KeyValueList,
  LoadingButton,
  SectionCard,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const EMAIL_LOCKED = "Email is managed by your sign-in provider and cannot be changed here."

type ProfileUser = { name: string; email: string; image?: string | null }

type ProfileCardProps = {
  user: ProfileUser
  /** Resolves false when the file is not a PNG or JPEG up to 1 MB; throws when the upload fails. */
  onUpload: (file: File) => Promise<boolean>
  onRemove: () => Promise<void>
  onRename: (name: string) => Promise<void>
}

/** Avatar with change/remove, the name form and the read-only email (docs/design.md §7.2). */
export function ProfileCard({ user, onUpload, onRemove, onRename }: ProfileCardProps) {
  const [pictureError, setPictureError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function choosePicture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      const accepted = await onUpload(file)
      setPictureError(accepted ? null : "Use a PNG or JPEG image smaller than 1 MB.")
      if (accepted) appToast.success("Profile picture updated.")
    } catch (error) {
      console.error(error)
      setPictureError(null)
      appToast.error("Couldn't update your profile picture.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <SectionCard title="Profile" padding="settings">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar className="size-16 after:border-(--pn-line)">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-(--pn-accent-solid) text-lg font-medium text-(--pn-accent-solid-fg)">
            {initialsOf(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          {user.name ? (
            <p className="truncate text-sm leading-5 font-medium" title={user.name}>
              {user.name}
            </p>
          ) : (
            <p className="truncate text-sm leading-5 font-medium text-(--pn-fg-muted)">Complete your profile</p>
          )}
          <p className="truncate text-[13px] leading-5 text-(--pn-fg-muted)" title={user.email}>
            {user.email}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {user.image && (
              <Button variant="ghost" size="sm" className={buttonMotion} onClick={() => setRemoving(true)}>
                Remove
              </Button>
            )}
            <LoadingButton
              variant="outline"
              pending={uploading}
              aria-describedby="profile-picture-hint"
              onClick={() => fileRef.current?.click()}
            >
              Change picture
            </LoadingButton>
          </div>
          {/* The error takes the hint's line, so nothing below moves (§7.2). */}
          {pictureError ? (
            <p
              id="profile-picture-hint"
              role="alert"
              className="flex items-center gap-1.5 text-xs whitespace-nowrap text-(--pn-danger-fg)"
            >
              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
              {pictureError}
            </p>
          ) : (
            <p id="profile-picture-hint" className="text-xs text-(--pn-fg-muted)">
              PNG or JPEG, up to 1 MB.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            onChange={(event) => void choosePicture(event)}
          />
        </div>
      </div>
      <div className="mt-5 border-t border-(--pn-line) pt-5">
        <NameForm key={user.name} name={user.name} email={user.email} onRename={onRename} />
      </div>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove profile picture?"
        description="Your current picture will be removed from this account."
        confirmLabel="Remove picture"
        onConfirm={async () => {
          await onRemove()
          setPictureError(null)
          appToast.success("Profile picture removed.")
        }}
      />
    </SectionCard>
  )
}

type NameFormProps = { name: string; email: string; onRename: (name: string) => Promise<void> }

function NameForm({ name, email, onRename }: NameFormProps) {
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const id = useId()
  const changed = draft.trim() !== name

  function validate(value: string) {
    return value.trim() === "" ? "Enter your full name." : null
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!changed || saving) return
    const problem = validate(draft)
    setError(problem)
    if (problem) return
    setSaving(true)
    try {
      await onRename(draft.trim())
      appToast.success("Name updated.")
    } catch (error) {
      console.error(error)
      appToast.error("Couldn't update your name.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <FormField label="Full name" htmlFor={id} error={error}>
        <Input
          id={id}
          value={draft}
          autoComplete="name"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? fieldHintId(id) : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (error) setError(validate(draft))
          }}
          className={cn("h-9 px-3", fieldControl)}
        />
      </FormField>
      <KeyValueList
        items={[
          {
            key: "Email",
            value: (
              <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
                <span className="truncate" title={email}>
                  {email}
                </span>
                <Hint label={EMAIL_LOCKED}>
                  <button
                    type="button"
                    aria-label={EMAIL_LOCKED}
                    className="relative grid size-5 shrink-0 place-items-center rounded-(--pn-r-1) text-(--pn-fg-muted) after:absolute after:-inset-2"
                  >
                    <Lock aria-hidden className="size-3.5" />
                  </button>
                </Hint>
              </span>
            ),
          },
        ]}
      />
      <div className="flex justify-end">
        <LoadingButton type="submit" pending={saving} disabled={!changed}>
          Save name
        </LoadingButton>
      </div>
    </form>
  )
}
