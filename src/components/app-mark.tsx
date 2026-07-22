import { Link } from "@tanstack/react-router"
import logoUrl from "@/assets/logo.png"
import { cn } from "@/lib/utils"

export function AppMark({
  compact = false,
  sidebarResponsive = false,
  onClick,
}: {
  compact?: boolean
  sidebarResponsive?: boolean
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        "flex w-max items-center gap-3 rounded-lg text-inherit outline-none focus-visible:ring-3 focus-visible:ring-current/25",
        sidebarResponsive && "group-data-[collapsible=icon]:gap-0"
      )}
      aria-label="PoliNetwork Admin home"
      onClick={onClick}
    >
      <img
        className={cn("size-9 rounded-full", sidebarResponsive && "group-data-[collapsible=icon]:size-8")}
        src={logoUrl}
        alt=""
        width={36}
        height={36}
      />
      {!compact && (
        <span className={cn("block leading-none", sidebarResponsive && "group-data-[collapsible=icon]:hidden")}>
          <strong className="block text-sm font-semibold tracking-[-0.025em]">PoliNetwork</strong>
          <small className="mt-1.5 block text-[9px] leading-none font-medium tracking-[0.12em] text-current/65 uppercase">
            Admin dashboard
          </small>
        </span>
      )}
    </Link>
  )
}
