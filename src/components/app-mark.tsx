import { Link } from "@tanstack/react-router"
import logoUrl from "@/assets/logo.png"

export function AppMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/dashboard" className="app-mark" aria-label="PoliNetwork Admin home">
      <img src={logoUrl} alt="" width={36} height={36} />
      {!compact && (
        <span>
          <strong>PoliNetwork</strong>
          <small>ADMIN CONSOLE</small>
        </span>
      )}
    </Link>
  )
}
