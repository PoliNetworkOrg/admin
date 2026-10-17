import type { LogoRules } from "../web/logo-upload.tsx"
import type { AssociationLink, AssociationLinks } from "./types"

export const ASSOCIATION_LOGO_MAX_SIZE = 1024 * 1024
export const ASSOCIATION_LOGO_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const

export const ASSOCIATION_LOGO_RULES: LogoRules = {
  types: ASSOCIATION_LOGO_TYPES,
  maxSize: ASSOCIATION_LOGO_MAX_SIZE,
  typeError: "Choose a JPG, PNG, or SVG logo.",
  sizeError: "The logo must be no larger than 1 MB.",
  hint: "JPG, PNG or SVG, up to 1 MB",
}

export const ASSOCIATION_NAME_MAX_LENGTH = 200
export const ASSOCIATION_DESCRIPTION_MAX_LENGTH = 20_000
export const ASSOCIATION_LINK_MAX_LENGTH = 2048

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

export const ASSOCIATION_LINK_FIELDS: { key: AssociationLink; label: string; placeholder: string }[] = [
  { key: "email", label: "Email", placeholder: "info@example.org" },
  { key: "website", label: "Website", placeholder: "https://example.org" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@…" },
  { key: "x", label: "X", placeholder: "https://x.com/…" },
  { key: "telegram", label: "Telegram", placeholder: "https://t.me/…" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "spotify", label: "Spotify", placeholder: "https://open.spotify.com/…" },
]
