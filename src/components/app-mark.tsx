import { Link } from "@tanstack/react-router"
import logoUrl from "@/assets/logo.png"

export function AppMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/dashboard" className="flex w-max items-center gap-2.5 text-inherit" aria-label="PoliNetwork Admin home">
      <img className="size-9 rounded-full" src={logoUrl} alt="" width={36} height={36} />
      {!compact && (
        <span className="block leading-none">
          <strong className="block text-sm tracking-[-0.02em]">PoliNetwork</strong>
          <small className="mt-1.5 block font-mono text-[7px] leading-none font-medium tracking-[0.13em] text-current/55">
            ADMIN CONSOLE
          </small>
        </span>
      )}
    </Link>
  )
}
