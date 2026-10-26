export const FRESHMAN_ICON_NAMES = [
  "chart",
  "monitor",
  "book",
  "map",
  "news",
  "money",
  "folder",
  "repeat",
  "refresh",
  "bell",
  "user",
  "users",
  "cart",
  "home",
] as const

export const FRESHMAN_RESOURCE_GROUPS = [
  { id: "featured", title: "In evidenza" },
  { id: "guides", title: "Guide e Utility" },
  { id: "materials", title: "Materiali" },
  { id: "tools", title: "Tech Tools" },
]
export const FRESHMAN_TABS = [
  { value: "resources", label: "Resources" },
  { value: "telegram", label: "Telegram Hub" },
  { value: "faqs", label: "FAQs" },
  { value: "guide", label: "Guide" },
] as const

export type FreshmanTab = (typeof FRESHMAN_TABS)[number]["value"]
