import { AtSign, Globe, Instagram, Link, Linkedin, Mail, Music, Send, Youtube } from "lucide-react"
import type { AssociationLinks, LinkField } from "./types"

export const ASSOCIATION_LINK = {
  EMAIL: "email",
  WEBSITE: "website",
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  X: "x",
  TELEGRAM: "telegram",
  LINKEDIN: "linkedin",
  YOUTUBE: "youtube",
  SPOTIFY: "spotify",
} as const

export const EMPTY_ASSOCIATION_LINKS: AssociationLinks = {
  [ASSOCIATION_LINK.EMAIL]: null,
  [ASSOCIATION_LINK.WEBSITE]: null,
  [ASSOCIATION_LINK.FACEBOOK]: null,
  [ASSOCIATION_LINK.INSTAGRAM]: null,
  [ASSOCIATION_LINK.TIKTOK]: null,
  [ASSOCIATION_LINK.X]: null,
  [ASSOCIATION_LINK.YOUTUBE]: null,
  [ASSOCIATION_LINK.TELEGRAM]: null,
  [ASSOCIATION_LINK.LINKEDIN]: null,
  [ASSOCIATION_LINK.SPOTIFY]: null,
}

export const LINK_FIELDS: LinkField[] = [
  { key: ASSOCIATION_LINK.EMAIL, label: "Email", icon: Mail },
  { key: ASSOCIATION_LINK.WEBSITE, label: "Website", icon: Globe },
  { key: ASSOCIATION_LINK.FACEBOOK, label: "Facebook", icon: Link },
  { key: ASSOCIATION_LINK.INSTAGRAM, label: "Instagram", icon: Instagram },
  { key: ASSOCIATION_LINK.TIKTOK, label: "TikTok", icon: Music },
  { key: ASSOCIATION_LINK.X, label: "X", icon: AtSign },
  { key: ASSOCIATION_LINK.TELEGRAM, label: "Telegram", icon: Send },
  { key: ASSOCIATION_LINK.LINKEDIN, label: "LinkedIn", icon: Linkedin },
  { key: ASSOCIATION_LINK.YOUTUBE, label: "YouTube", icon: Youtube },
  { key: ASSOCIATION_LINK.SPOTIFY, label: "Spotify", icon: Music },
]
