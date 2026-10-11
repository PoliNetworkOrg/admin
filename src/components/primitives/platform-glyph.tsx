import { MessageCircle, Send } from "lucide-react"

import type { GroupWithLabels } from "@/lib/api/types"
import { cn } from "@/lib/utils"

const platforms = {
  tg: { icon: Send, label: "Telegram" },
  wa: { icon: MessageCircle, label: "WhatsApp" },
}

/** The platform as its monochrome service icon (the rail's), named for assistive tech. Size it with `className`. */
export function PlatformGlyph({ platform, className }: { platform: GroupWithLabels["type"]; className?: string }) {
  const { icon: Icon, label } = platforms[platform]
  return (
    <Icon
      role="img"
      aria-label={label}
      strokeWidth={1.75}
      className={cn("size-4 shrink-0 text-(--pn-fg-muted)", className)}
    />
  )
}
