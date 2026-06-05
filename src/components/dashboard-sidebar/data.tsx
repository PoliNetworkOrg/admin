import Image from "next/image"
import azureSvg from "@/assets/svg/azure.svg"
import telegramSvg from "@/assets/svg/telegram.svg"

export type NavItem = {
  title: string
  url: string
  items?: NavItem[]
}

export const DSData = {
  mainNav: [
    {
      title: "Telegram",
      url: "/dashboard/telegram",
      icon: <Image alt="telegram logo" src={telegramSvg} className="size-4" />,
      items: [
        { title: "Grants", url: "/dashboard/telegram/grants" },
        { title: "Groups", url: "/dashboard/telegram/groups" },
        { title: "Users", url: "/dashboard/telegram/user-list" },
      ],
    },
    {
      title: "Azure",
      url: "/dashboard/azure",
      icon: <Image alt="azure logo" src={azureSvg} className="size-4" />,
      items: [{ title: "Members", url: "/dashboard/azure/members" }],
    },
  ],
}

const flattenNavigation = (): Map<string, string> => {
  const map = new Map<string, string>()
  const traverse = (list: NavItem[]) => {
    for (const item of list) {
      map.set(item.url, item.title)
      if (item.items) traverse(item.items)
    }
  }
  Object.entries(DSData).forEach(([_k, items]) => {
    traverse(items)
  })
  return map
}

export const NAV_MAP = flattenNavigation()
