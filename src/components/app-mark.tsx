import { Link } from "@tanstack/react-router"
import logoUrl from "@/assets/logo.png"

export function AppMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/dashboard"
      className="flex w-max items-center gap-3 rounded-lg text-inherit outline-none focus-visible:ring-3 focus-visible:ring-current/25"
      aria-label="PoliNetwork Admin home"
    >
      <img className="size-9 rounded-full" src={logoUrl} alt="" width={36} height={36} />
      {!compact && (
        <span className="block leading-none">
          <strong className="block text-sm font-semibold tracking-[-0.025em]">PoliNetwork</strong>
          <small className="mt-1.5 block text-[9px] leading-none font-medium tracking-[0.12em] text-current/65 uppercase">
            Admin dashboard
          </small>
        </span>
      )}
    </Link>
  )
}
