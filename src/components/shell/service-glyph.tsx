import { cn } from "@/lib/utils"

import type { Service } from "./nav"

/** A service's branded logo when it has one, else its monochrome lucide icon. Size it with `className`. */
export function ServiceGlyph({ service, className }: { service: Service; className?: string }) {
  if (service.logo) {
    return <img src={service.logo} alt="" aria-hidden className={cn("shrink-0 object-contain", className)} />
  }
  return <service.icon aria-hidden strokeWidth={1.75} className={cn("shrink-0", className)} />
}
