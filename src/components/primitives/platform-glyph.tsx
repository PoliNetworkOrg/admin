import telegramLogo from "@/assets/svg/telegram.svg"
import whatsappLogo from "@/assets/svg/whatsapp.svg"
import type { GroupWithLabels } from "@/lib/api/types"
import { cn } from "@/lib/utils"

const platforms = {
  tg: { logo: telegramLogo, label: "Telegram" },
  wa: { logo: whatsappLogo, label: "WhatsApp" },
}

/** The 16px platform logo, named for assistive tech. */
export function PlatformGlyph({ platform, className }: { platform: GroupWithLabels["type"]; className?: string }) {
  const { logo, label } = platforms[platform]
  return <img src={logo} alt={label} width={16} height={16} className={cn("size-4 shrink-0", className)} />
}
