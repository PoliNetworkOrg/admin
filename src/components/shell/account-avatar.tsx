import { initialsOf } from "@/components/primitives"
import { cn } from "@/lib/utils"

/** The signed-in admin as the shell shows them: rail avatar, sheet row, tooltip. */
export type ShellUser = { name: string; email: string; image: string | null }

/** 28px avatar: the profile picture, else initials on the solid accent. */
export function AccountAvatar({ user, className }: { user: ShellUser; className?: string }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt=""
        className={cn("size-7 rounded-full object-cover shadow-(--pn-media-ring)", className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 place-items-center rounded-full bg-(--pn-accent-solid) text-[11px] font-semibold text-(--pn-accent-solid-fg)",
        className
      )}
    >
      {initialsOf(user.name, user.email)}
    </span>
  )
}
