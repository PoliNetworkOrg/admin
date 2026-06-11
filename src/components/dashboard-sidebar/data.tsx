import { Globe, MessageCircleMoreIcon, Sparkle, Users } from "lucide-react"
import Image from "next/image"
import azureSvg from "@/assets/svg/azure.svg"
import telegramSvg from "@/assets/svg/telegram.svg"

export const DSData = {
  mainNav: [
    {
      title: "Telegram",
      icon: <Image alt="telegram logo" src={telegramSvg} className="size-4" />,
      items: [
        { title: "Grants", url: "/dashboard/telegram/grants", icon: <Sparkle /> },
        { title: "Groups", url: "/dashboard/telegram/groups", icon: <MessageCircleMoreIcon /> },
        { title: "Users", url: "/dashboard/telegram/users", icon: <Users /> },
      ],
    },
    {
      title: "Azure",
      icon: <Image alt="azure logo" src={azureSvg} className="size-4" />,
      items: [{ title: "Members", url: "/dashboard/azure/members", icon: <Users /> }],
    },
    {
      title: "Web",
      icon: <Globe />,
      items: [{ title: "Associations", url: "/dashboard/web/associations", icon: <Users /> }],
    },
  ],
}

const flattenNavigation = (): Map<string, string> => {
  const map = new Map<string, string>()
  const traverse = (list: { title: string; url?: string }[]) => {
    for (const item of list) {
      if (!item.url) continue
      map.set(item.url, item.title)
    }
  }
  Object.entries(DSData).forEach(([_k, nav]) => {
    nav.forEach((category) => {
      traverse(category.items)
    })
  })
  return map
}

export const NAV_MAP = flattenNavigation()
