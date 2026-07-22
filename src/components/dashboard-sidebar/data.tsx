import Image from "next/image"
import { FiBookOpen, FiGlobe, FiMessageCircle, FiMessageSquare, FiUsers, FiZap } from "react-icons/fi"
import azureSvg from "@/assets/svg/azure.svg"
import telegramSvg from "@/assets/svg/telegram.svg"

export const DSData = {
  mainNav: [
    {
      title: "Telegram",
      icon: <Image alt="telegram logo" src={telegramSvg} className="size-4" />,
      items: [
        { title: "Grants", url: "/dashboard/telegram/grants", icon: <FiZap /> },
        { title: "Groups", url: "/dashboard/telegram/groups", icon: <FiMessageSquare /> },
        { title: "Users", url: "/dashboard/telegram/users", icon: <FiUsers /> },
      ],
    },
    {
      title: "Azure",
      icon: <Image alt="azure logo" src={azureSvg} className="size-4" />,
      items: [
        { title: "Groups", url: "/dashboard/azure/groups", icon: <FiUsers /> },
        { title: "Members", url: "/dashboard/azure/members", icon: <FiUsers /> },
      ],
    },
    {
      title: "Web",
      icon: <FiGlobe className="size-4" />,
      items: [
        { title: "Guide", url: "/dashboard/web/guide", icon: <FiBookOpen /> },
        { title: "FAQs", url: "/dashboard/web/faqs", icon: <FiMessageCircle /> },
      ],
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
