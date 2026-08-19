import { AtSign, Globe, Instagram, Linkedin, LinkIcon, Mail, Music2, Send, Youtube } from "lucide-react"
import type { AssociationLink, AssociationLinks } from "./types"

export const ASSOCIATION_LOGO_MAX_SIZE = 1024 * 1024
export const ASSOCIATION_LOGO_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const

export const EMPTY_ASSOCIATION_LINKS: AssociationLinks = {
  email: null,
  website: null,
  facebook: null,
  instagram: null,
  tiktok: null,
  x: null,
  youtube: null,
  telegram: null,
  linkedin: null,
  spotify: null,
}

export const ASSOCIATION_LINK_FIELDS: {
  key: AssociationLink
  label: string
  placeholder: string
  icon: typeof Mail
}[] = [
  { key: "email", label: "Email", placeholder: "info@example.org", icon: Mail },
  { key: "website", label: "Website", placeholder: "https://example.org", icon: Globe },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…", icon: LinkIcon },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…", icon: Instagram },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@…", icon: Music2 },
  { key: "x", label: "X", placeholder: "https://x.com/…", icon: AtSign },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/…", icon: Send },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/…", icon: Linkedin },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…", icon: Youtube },
  { key: "spotify", label: "Spotify", placeholder: "https://open.spotify.com/…", icon: Music2 },
]

export function getAssociationInitials(name: string) {
  const words = name.replaceAll("-", " ").split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toLocaleUpperCase()
  return (words[0] ?? "").slice(0, 2).toLocaleUpperCase()
}
